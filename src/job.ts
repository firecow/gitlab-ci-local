import chalk from "chalk";
import * as dotenv from "dotenv";
import fs from "fs-extra";
import prettyHrtime from "pretty-hrtime";
import split2 from "split2";
import {Utils} from "./utils.js";
import {WriteStreams} from "./write-streams.js";
import {GitData} from "./git-data.js";
import assert, {AssertionError} from "assert";
import {Mutex} from "./mutex.js";
import {Argv} from "./argv.js";
import execa from "execa";
import {CICDVariable} from "./variables-from-files.js";
import {GitlabRunnerCPUsPresetValue, GitlabRunnerMemoryPresetValue, GitlabRunnerPresetValues} from "./gitlab-preset.js";
import {handler} from "./handler.js";
import * as yaml from "js-yaml";
import {Parser} from "./parser.js";
import {resolveIncludeLocal, validateIncludeLocal} from "./parser-includes.js";
import globby from "globby";
import terminalLink from "terminal-link";

const GCL_SHELL_PROMPT_PLACEHOLDER = "<gclShellPromptPlaceholder>";
interface JobOptions {
    argv: Argv;
    writeStreams: WriteStreams;
    data: any;
    name: string;
    baseName: string;
    pipelineIid: number;
    gitData: GitData;
    globalVariables: {[name: string]: string};
    variablesFromFiles: {[name: string]: CICDVariable};
    predefinedVariables: {[name: string]: any};
    matrixVariables: {[key: string]: string} | null;
    nodeIndex: number | null;
    nodesTotal: number;
    expandVariables: boolean;
}

interface Cache {
    policy: "pull" | "pull-push" | "push";
    key: string | {files: string[]};
    paths: string[];
    when: "on_success" | "on_failure" | "always";
}

interface Service {
    name: string;
    entrypoint: string[] | null;
    command: string[] | null;
    alias: string | null;
    variables: {[name: string]: string};
}

export interface Need {
    job: string;
    artifacts: boolean;
    optional?: boolean;
    ref?: string;
    pipeline?: string;
    project?: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: undefined,
    month: undefined,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
});

export type JobRule = {
    if?: string;
    when?: string;
    changes?: string[] | {paths: string[]};
    exists?: string[];
    allow_failure?: boolean;
    variables?: {[name: string]: string};
};

export class Job {
    private generateJobId (): number {
        return Math.floor(Math.random() * 1000000);
    }

    static readonly illegalJobNames = new Set([
        "include", "local_configuration", "image", "services",
        "stages", "before_script", "default",
        "after_script", "variables", "cache", "workflow", "page:deploy",
    ]);

    readonly argv: Argv;
    readonly name: string;
    readonly baseName: string;
    readonly dependencies: string[] | null;
    readonly environment?: {name: string; url: string | null; deployment_tier: string | null; action: string | null};
    readonly jobId: number;
    readonly rules?: JobRule[];

    readonly allowFailure: boolean | {
        exit_codes: number | number[];
    };
    readonly when: string;
    readonly exists: string[];
    readonly pipelineIid: number;
    readonly gitData: GitData;
    readonly inherit: {
        variables?: boolean | string[];
    };

    private _dotenvVariables: {[key: string]: string} = {};
    private _prescriptsExitCode: number | null = null;
    private _afterScriptsExitCode = 0;
    private _coveragePercent: string | null = null;
    private _running = false;
    private _containerId: string | null = null;
    private _serviceNetworkId: string | null = null;
    private _longRunningSilentTimeout: NodeJS.Timeout = -1 as any;
    private _producers: {name: string; dotenv: string | null}[] | null = null;
    private _jobNamePad: number | null = null;
    private _ciProjectDir: string | null = null;
    private _startTime?: [number, number];
    private _endTime?: [number, number];

    private readonly _filesToRm: string[] = [];
    private readonly _globalVariables: {[key: string]: string} = {};
    private readonly _variables: {[key: string]: string} = {};
    private readonly _containersToClean: string[] = [];
    private readonly _containerVolumeNames: string[] = [];
    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;

    constructor (opt: JobOptions) {
        const jobData = opt.data;
        const jobVariables = jobData.variables ?? {};
        const variablesFromFiles = opt.variablesFromFiles;
        const argv = opt.argv;
        const cwd = argv.cwd;
        const argvVariables = argv.variable;
        const expandVariables = opt.expandVariables ?? true;

        this.argv = argv;
        this.writeStreams = opt.writeStreams;
        this.gitData = opt.gitData;
        this.name = opt.name;
        this.baseName = opt.baseName;
        this.jobId = this.generateJobId();
        this.jobData = opt.data;
        this.pipelineIid = opt.pipelineIid;
        this._globalVariables = opt.globalVariables;

        this.inherit = {};
        this.inherit.variables = this.jobData.inherit?.variables ?? true;

        this.when = jobData.when || "on_success";
        this.exists = jobData.exists || [];
        this.allowFailure = jobData.allow_failure ?? false;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;

        const matrixVariables = opt.matrixVariables ?? {};
        const fileVariables = Utils.findEnvMatchedVariables(variablesFromFiles, this.fileVariablesDir);
        const predefinedVariables = this._predefinedVariables(opt);
        this._variables = {...predefinedVariables, ...this.globalVariables, ...jobVariables, ...matrixVariables, ...fileVariables, ...argvVariables};

        if (this.rules && expandVariables) {
            const expanded = Utils.expandVariables(this._variables);

            // Expand variables in rules:changes
            this.rules.forEach((rule, ruleIdx, rules) => {
                const changes = Array.isArray(rule.changes) ? rule.changes : rule.changes?.paths;
                if (!changes) {
                    return;
                }

                changes.forEach((change, changeIdx, changes) => {
                    changes[changeIdx] = Utils.expandText(change, expanded);
                });
                rules[ruleIdx].changes = changes;
            });

            // Expand variables in rules:exists
            this.rules.forEach((rule, ruleIdx, rules) => {
                const exists = Array.isArray(rule.exists) ? rule.exists : null;
                if (!exists) {
                    return;
                }
                exists.forEach((exist, existId, exists) => {
                    exists[existId] = Utils.expandText(exist, expanded);
                });
                rules[ruleIdx].exists = exists;
            });
        }

        let ruleVariables: {[name: string]: string} | undefined;
        // Set {when, allowFailure} based on rules result
        if (this.rules) {
            const ruleResult = Utils.getRulesResult({argv, cwd, rules: this.rules, variables: this._variables}, this.gitData, this.when, this.allowFailure);
            this.when = ruleResult.when;
            this.allowFailure = ruleResult.allowFailure;
            ruleVariables = ruleResult.variables;
            this._variables = {...this._variables, ...ruleVariables, ...argvVariables};
        }

        // Find environment matched variables
        if (this.environment && expandVariables) {
            const expanded = Utils.expandVariables(this._variables);
            this.environment.name = Utils.expandText(this.environment.name, expanded);
            this.environment.url = Utils.expandText(this.environment.url, expanded);
        }
        const envMatchedVariables = Utils.findEnvMatchedVariables(variablesFromFiles, this.fileVariablesDir, this.environment);

        const userDefinedVariables = {...this.globalVariables, ...jobVariables, ...matrixVariables, ...ruleVariables, ...envMatchedVariables, ...argvVariables};
        this.discourageOverridingOfPredefinedVariables(predefinedVariables, userDefinedVariables);

        // Merge and expand after finding env matched variables
        this._variables = {...predefinedVariables, ...userDefinedVariables};
        // Delete variables the user intentionally wants unset
        for (const unsetVariable of argv.unsetVariables) {
            delete this._variables[unsetVariable];
        }
        // Set GCL_PROJECT_DIR_ON_HOST if docker image
        if (this.imageName(this._variables)) {
            this._variables = {...this._variables, ...{GCL_PROJECT_DIR_ON_HOST: cwd}};
        }

        assert(this.scripts || this.trigger, chalk`{blueBright ${this.name}} must have script specified`);

        assert(!(this.interactive && !this.argv.shellExecutorNoImage), chalk`${this.formattedJobName} @Interactive decorator cannot be used with --no-shell-executor-no-image`);

        if (this.interactive && (this.when !== "manual" || this.imageName(this._variables) !== null)) {
            throw new AssertionError({message: `${this.formattedJobName} @Interactive decorator cannot have image: and must be when:manual`});
        }

        if (this.injectSSHAgent && this.imageName(this._variables) === null) {
            throw new AssertionError({message: `${this.formattedJobName} @InjectSSHAgent can only be used with image:`});
        }

        const expanded = Utils.expandVariables(this._variables);
        for (const [i, c] of Object.entries<any>(this.cache)) {
            c.policy = Utils.expandText(c.policy, expanded);
            assert(["pull", "push", "pull-push"].includes(c.policy), chalk`{blue ${this.name}} cache[${i}].policy is not 'pull', 'push' or 'pull-push'`);
            assert(["on_success", "on_failure", "always"].includes(c.when), chalk`{blue ${this.name}} cache[${i}].when is not 'on_success', 'on_failure' or 'always'`);
            assert(Array.isArray(c.paths), chalk`{blue ${this.name}} cache[${i}].paths must be array`);
        }

        for (const [i, s] of Object.entries<any>(this.services)) {
            assert(s.name, chalk`{blue ${this.name}} services[${i}].name is undefined`);
            assert(!s.command || Array.isArray(s.command), chalk`{blue ${this.name}} services[${i}].command must be an array`);
            assert(!s.entrypoint || Array.isArray(s.entrypoint), chalk`{blue ${this.name}} services[${i}].entrypoint must be an array`);
        }

        assert(!this.artifacts?.paths || Array.isArray(this.artifacts.paths), chalk`{blue ${this.name}} artifacts.paths must be an array`);

        if (this.imageName(this._variables) && argv.mountCache) {
            for (const c of this.cache) {
                c.paths.forEach((p) => {
                    const path = Utils.expandText(p, expanded);
                    assert(!path.includes("*"), chalk`{blue ${this.name}} cannot have * in cache paths, when --mount-cache is enabled`);
                });
            }
        }
    }

    /**
     *  Warn when overriding of predefined variables is detected
     */
    private discourageOverridingOfPredefinedVariables (predefinedVariables: {[name: string]: string}, userDefinedVariables: {[name: string]: string}) {
        const predefinedVariablesKeys = Object.keys(predefinedVariables);
        const userDefinedVariablesKeys = Object.keys(userDefinedVariables);

        const overridingOfPredefinedVariables = userDefinedVariablesKeys.filter(ele => predefinedVariablesKeys.includes(ele));
        if (overridingOfPredefinedVariables.length == 0) {
            return;
        }

        const linkToGitlab = "https://gitlab.com/gitlab-org/gitlab/-/blob/v17.7.1-ee/doc/ci/variables/predefined_variables.md?plain=1&ref_type=tags#L15-16";
        this.writeStreams.memoStdout(chalk`{bgYellowBright  WARN } ${terminalLink("Avoid overriding predefined variables", linkToGitlab)} [{bold ${overridingOfPredefinedVariables}}] as it can cause the pipeline to behave unexpectedly.\n`);
    }

    /**
     * Get the predefinedVariables that's enriched with the additional info that's only available when constructing
     */
    private _predefinedVariables (opt: JobOptions) {
        const argv = this.argv;
        const cwd = argv.cwd;
        const stateDir = this.argv.stateDir;
        const gitData = this.gitData;

        let ciBuildsDir: string;
        if (this.jobData["image"]) {
            ciBuildsDir = "/builds";
            this.ciProjectDir = `${ciBuildsDir}/${gitData.remote.group}/${gitData.remote.project}`;
        } else if (argv.shellIsolation) {
            ciBuildsDir = `${cwd}/${stateDir}/builds/${this.safeJobName}`;
            this.ciProjectDir = ciBuildsDir;
        } else {
            ciBuildsDir = cwd;
            this.ciProjectDir = ciBuildsDir;
        }

        const predefinedVariables = opt.predefinedVariables;

        predefinedVariables["CI_JOB_ID"] = `${this.jobId}`;
        predefinedVariables["CI_PIPELINE_ID"] = `${this.pipelineIid + 1000}`;
        predefinedVariables["CI_PIPELINE_IID"] = `${this.pipelineIid}`;
        predefinedVariables["CI_JOB_NAME"] = `${this.name}`;
        predefinedVariables["CI_JOB_NAME_SLUG"] = `${this.name.replace(/[^a-z\d]+/ig, "-").replace(/^-/, "").slice(0, 63).replace(/-$/, "").toLowerCase()}`;
        predefinedVariables["CI_JOB_STAGE"] = `${this.stage}`;
        predefinedVariables["CI_BUILDS_DIR"] = ciBuildsDir;
        predefinedVariables["CI_PROJECT_DIR"] = this.ciProjectDir;
        predefinedVariables["CI_JOB_URL"] = `${predefinedVariables["CI_SERVER_URL"]}/${gitData.remote.group}/${gitData.remote.project}/-/jobs/${this.jobId}`; // Changes on rerun.
        predefinedVariables["CI_PIPELINE_URL"] = `${predefinedVariables["CI_SERVER_URL"]}/${gitData.remote.group}/${gitData.remote.project}/pipelines/${this.pipelineIid}`;
        predefinedVariables["CI_ENVIRONMENT_NAME"] = this.environment?.name ?? "";
        predefinedVariables["CI_ENVIRONMENT_SLUG"] = this.environment?.name?.replace(/[^a-z\d]+/ig, "-").replace(/^-/, "").slice(0, 23).replace(/-$/, "").toLowerCase() ?? "";
        predefinedVariables["CI_ENVIRONMENT_URL"] = this.environment?.url ?? "";
        predefinedVariables["CI_ENVIRONMENT_TIER"] = this.environment?.deployment_tier ?? "";
        predefinedVariables["CI_ENVIRONMENT_ACTION"] = this.environment?.action ?? "";

        if (opt.nodeIndex !== null) {
            predefinedVariables["CI_NODE_INDEX"] = `${opt.nodeIndex}`;
        }
        predefinedVariables["CI_NODE_TOTAL"] = `${opt.nodesTotal}`;
        predefinedVariables["CI_REGISTRY"] = `local-registry.${this.gitData.remote.host}`;
        predefinedVariables["CI_REGISTRY_IMAGE"] = `$CI_REGISTRY/${predefinedVariables["CI_PROJECT_PATH"].toLowerCase()}`;
        return predefinedVariables;
    }

    get jobStatus () {
        if (this.preScriptsExitCode == null) return "pending";
        if (this.preScriptsExitCode == 0) return "success";

        let allowedExitCodes = [0];
        const allowFailure = this.allowFailure;
        switch (typeof allowFailure) {
            case "boolean":
                if (allowFailure) {
                    allowedExitCodes = [this.preScriptsExitCode];
                }
                break;
            case "object":
                if (! Array.isArray(allowFailure.exit_codes)) {
                    allowedExitCodes = [allowFailure.exit_codes];
                } else {
                    allowedExitCodes = allowFailure.exit_codes;
                }
                break;
            default:
                throw new Error(`Unexpected type:  ${typeof allowFailure}`);
        }

        return allowedExitCodes.includes(this.preScriptsExitCode) ? "warning" : "failed";
    }

    get artifactsToSource () {
        if (this.jobData["gclArtifactsToSource"] != null) return this.jobData["gclArtifactsToSource"];
        return this.argv.artifactsToSource;
    }

    get prettyDuration () {
        if (this._endTime) {
            return prettyHrtime(this._endTime);
        }

        return this._startTime ?
            prettyHrtime(process.hrtime(this._startTime)) :
            "0 ms";
    }

    get formattedJobName () {
        let prefix = "";
        if (this.argv.childPipelineDepth > 0) prefix = "\t".repeat(this.argv.childPipelineDepth) + `[${this.argv.variable.GCL_TRIGGERER}] -> `;
        const timestampPrefix = this.argv.showTimestamps ?
            `[${dateFormatter.format(new Date())} ${this.prettyDuration.padStart(7)}] ` :
            "";

        // [16:33:19 1.37 min] my-job     > hello world
        return chalk`${timestampPrefix}{blueBright ${prefix}${this.name.padEnd(this.jobNamePad)}}`;
    }

    get safeJobName () {
        return Utils.safeDockerString(this.name);
    }

    get needs (): Need[] | null {
        return this.jobData["needs"] ?? null;
    }

    get buildVolumeName (): string {
        return `gcl-${this.safeJobName}-${this.jobId}-build`;
    }

    get tmpVolumeName (): string {
        return `gcl-${this.safeJobName}-${this.jobId}-tmp`;
    }

    get services (): Service[] {
        const services: Service[] = [];
        if (!this.jobData["services"]) return [];

        for (const service of Object.values<any>(this.jobData["services"])) {
            const expanded = Utils.expandVariables({...this._variables, ...this._dotenvVariables, ...service["variables"]});
            let serviceName = Utils.expandText(service["name"], expanded);
            if (serviceName == "") continue;
            serviceName = serviceName.includes(":") ? serviceName : `${serviceName}:latest`;
            services.push({
                name: serviceName,
                entrypoint: service["entrypoint"] ?? null,
                command: service["command"] ?? null,
                variables: expanded,
                alias: Utils.expandText(service["alias"], expanded) ?? null,
            });
        }
        return services;
    }

    set ciProjectDir (ciProjectDir: string) {
        assert(this._ciProjectDir == null, "this._ciProjectDir can only be set once");
        this._ciProjectDir = ciProjectDir;
    }
    get ciProjectDir () {
        assert(this._ciProjectDir, "attempted to access this._ciProjectDir before it is initialized");
        return this._ciProjectDir;
    }

    set jobNamePad (jobNamePad: number) {
        assert(this._jobNamePad == null, "this._jobNamePad can only be set once");
        this._jobNamePad = jobNamePad;
    }

    get jobNamePad (): number {
        return this._jobNamePad ?? 0;
    }

    get producers (): {name: string; dotenv: string | null}[] | null {
        return this._producers;
    }

    set producers (producers: {name: string; dotenv: string | null}[] | null) {
        assert(this._producers == null, "this._producers can only be set once");
        this._producers = producers;
    }

    get stage (): string {
        return this.jobData["stage"] || "test";
    }

    get interactive (): boolean {
        return this.jobData["gclInteractive"] || false;
    }

    get injectSSHAgent (): boolean {
        return this.jobData["gclInjectSSHAgent"] || false;
    }

    get description (): string {
        return this.jobData["gclDescription"] ?? "";
    }

    get artifacts (): {paths: string[]; exclude?: string[]; reports?: {dotenv?: string}; when?: string} | null {
        return this.jobData["artifacts"];
    }

    deleteArtifacts () {
        delete this.jobData["artifacts"];
    }

    get cache (): Cache[] {
        return this.jobData["cache"] || [];
    }

    public async getUniqueCacheName (cwd: string, expanded: {[key: string]: string}, cacheIndex: number) {
        const getCachePrefix = (index: number) => {
            const prefix = this.jobData["cache"][index]["key"]["prefix"];
            if (prefix) {
                return `${index}_${Utils.expandText(prefix, expanded)}-`;
            }

            const filenames = this.jobData["cache"][index]["key"]["files"].map((p: string) => {
                const expandP = Utils.expandText(p, expanded);
                return expandP.split(".")[0];
            }).join("_");
            return `${index}_${filenames}-`;
        };

        const key = this.jobData["cache"][cacheIndex].key;

        if (typeof key === "string" || key == null) {
            return Utils.expandText(key ?? "default", expanded);
        }

        const files = key["files"].map((f: string) => {
            let path = Utils.expandText(f, expanded);
            if (path.startsWith(`${this.ciProjectDir}/`)) {
                path = path.slice(`${this.ciProjectDir}/`.length);
            }
            return `${cwd}/${path}`;
        });
        return getCachePrefix(cacheIndex) + await Utils.checksumFiles(cwd, files);
    }

    get beforeScripts (): string[] {
        const beforeScripts = this.jobData["before_script"] || [];
        return typeof beforeScripts === "string" ? [beforeScripts] : beforeScripts;
    }

    get afterScripts (): string[] {
        const afterScripts = this.jobData["after_script"] || [];
        return typeof afterScripts === "string" ? [afterScripts] : afterScripts;
    }

    get scripts (): string[] {
        const script = this.jobData["script"];
        return typeof script === "string" ? [script] : script;
    }

    get trigger (): any {
        return this.jobData["trigger"];
    }

    async startTriggerPipeline () {
        this.writeStreams.memoStdout(chalk`{bgYellowBright  WARN } downstream pipeline is experimental in gitlab-ci-local\n`);
        await this.fetchTriggerInclude();
        const variablesForDownstreamPipeline = Object.entries({...this.globalVariables, ...this.jobData.variables}).map(([key, value]) => `${key}=${value}`);

        const gclTriggerer = this.argv.variable["GCL_TRIGGERER"] ?
            `${this.argv.variable["GCL_TRIGGERER"]} -> ${this.name}` :
            this.name;
        await handler({
            ...Object.fromEntries(this.argv.map),
            file: `${this.argv.stateDir}/includes/triggers/${this.name}.yml`,
            variable: [
                chalk`GCL_TRIGGERER=${gclTriggerer}`,
                "CI_PIPELINE_SOURCE=parent_pipeline",
            ].concat(variablesForDownstreamPipeline),
        }, this.writeStreams, [], this.argv.childPipelineDepth + 1);
    }

    get preScriptsExitCode () {
        return this._prescriptsExitCode;
    }

    get afterScriptsExitCode () {
        return this._afterScriptsExitCode;
    }

    get started () {
        return this._running || this._prescriptsExitCode !== null;
    }

    get finished () {
        return !this._running && this._prescriptsExitCode !== null;
    }

    get coveragePercent (): string | null {
        return this._coveragePercent;
    }

    get fileVariablesDir () {
        return `/tmp/gitlab-ci-local-file-variables-${this._variables["CI_PROJECT_PATH_SLUG"]}-${this.jobId}`;
    }

    get globalVariables () {
        if (this.inherit.variables === false) {
            return {};
        } else if (Array.isArray(this.inherit.variables)) {
            const inheritVariables = this.inherit.variables;
            return Object.fromEntries(
                Object.entries(this._globalVariables).filter(([k]) => inheritVariables.includes(k)),
            );
        }
        return this._globalVariables;
    }

    async start (): Promise<void> {
        if (this.trigger) {
            await this.startTriggerPipeline();
            this._prescriptsExitCode = 0; // NOTE: so that `this.finished` will implicitly be set to true
            return;
        }

        this._running = true;

        const argv = this.argv;
        this._startTime = process.hrtime();
        this._variables["CI_JOB_STARTED_AT"] = new Date().toISOString().split(".")[0] + "Z";
        const writeStreams = this.writeStreams;
        this._dotenvVariables = await this.initProducerReportsDotenvVariables(writeStreams, Utils.expandVariables(this._variables));
        const expanded = Utils.unscape$$Variables(Utils.expandVariables({...this._variables, ...this._dotenvVariables}));
        const imageName = this.imageName(expanded);
        const helperImageName = argv.helperImage;
        const safeJobName = this.safeJobName;

        const outputLogFilePath = `${argv.cwd}/${argv.stateDir}/output/${safeJobName}.log`;
        await fs.ensureFile(outputLogFilePath);
        await fs.truncate(outputLogFilePath);

        if (!this.interactive) {
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright starting} ${imageName ?? "shell"} ({yellow ${this.stage}})\n`);
        }

        if (imageName) {
            await this.pullImage(writeStreams, imageName);

            const buildVolumeName = this.buildVolumeName;
            const tmpVolumeName = this.tmpVolumeName;
            const fileVariablesDir = this.fileVariablesDir;

            const volumePromises = [];
            volumePromises.push(Utils.spawn([this.argv.containerExecutable, "volume", "create", `${buildVolumeName}`], argv.cwd));
            volumePromises.push(Utils.spawn([this.argv.containerExecutable, "volume", "create", `${tmpVolumeName}`], argv.cwd));
            this._containerVolumeNames.push(buildVolumeName);
            this._containerVolumeNames.push(tmpVolumeName);
            await Promise.all(volumePromises);

            const time = process.hrtime();
            this.refreshLongRunningSilentTimeout(writeStreams);

            let chownOpt = "0:0";
            let chmodOpt = "a+rw";
            if (!this.argv.umask) {
                const {stdout} = await Utils.spawn([this.argv.containerExecutable, "run", "--rm", "--entrypoint", "sh", imageName, "-c", "echo \"$(id -u):$(id -g)\""]);
                chownOpt = stdout;
                if (chownOpt == "0:0") {
                    chmodOpt = "g-w";
                }
            }
            if (helperImageName) {
                await this.pullImage(writeStreams, helperImageName);
            }
            const {stdout: containerId} = await Utils.spawn([
                this.argv.containerExecutable, "create", "--user=0:0", `--volume=${buildVolumeName}:${this.ciProjectDir}`, `--volume=${tmpVolumeName}:${this.fileVariablesDir}`, `${helperImageName}`,
                ...["sh", "-c", `chown ${chownOpt} -R ${this.ciProjectDir} && chmod ${chmodOpt} -R ${this.ciProjectDir} && chown ${chownOpt} -R /tmp/ && chmod ${chmodOpt} -R /tmp/`],
            ], argv.cwd);
            this._containersToClean.push(containerId);
            if (await fs.pathExists(fileVariablesDir)) {
                await Utils.spawn([this.argv.containerExecutable, "cp", `${fileVariablesDir}/.`, `${containerId}:${fileVariablesDir}`], argv.cwd);
                this.refreshLongRunningSilentTimeout(writeStreams);
            }
            await Utils.spawn([this.argv.containerExecutable, "cp", `${argv.stateDir}/builds/.docker/.`, `${containerId}:${this.ciProjectDir}`], argv.cwd);
            await Utils.spawn([this.argv.containerExecutable, "start", "--attach", containerId], argv.cwd);
            await Utils.spawn([this.argv.containerExecutable, "rm", "-vf", containerId], argv.cwd);
            const endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright copied to ${this.argv.containerExecutable} volumes} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        if (this.services?.length) {
            // `host` and `none` networks do not work with services because aliases only work for
            // user defined networks.
            for (const network of this.argv.network) {
                if (["host", "none"].includes(network)) {
                    throw new AssertionError({message: `Cannot add service network alias with network mode '${network}'`});
                }
            }

            await this.createDockerNetwork(`gitlab-ci-local-${this.jobId}`);

            await Promise.all(
                this.services.map(async (service, serviceIndex) => {
                    const serviceName = service.name;
                    await this.pullImage(writeStreams, serviceName);
                    const serviceContainerId = await this.startService(writeStreams, Utils.expandVariables({...expanded, ...service.variables}), service);
                    const serviceContainerLogFile = `${argv.cwd}/${argv.stateDir}/services-output/${this.safeJobName}/${serviceName}-${serviceIndex}.log`;
                    await this.serviceHealthCheck(writeStreams, service, serviceIndex, serviceContainerLogFile);
                    const {stdout, stderr} = await Utils.spawn([this.argv.containerExecutable, "logs", serviceContainerId]);
                    await fs.ensureFile(serviceContainerLogFile);
                    await fs.promises.writeFile(serviceContainerLogFile, `### stdout ###\n${stdout}\n### stderr ###\n${stderr}\n`);
                }),
            );
        }

        await this.execPreScripts(expanded);
        if (this._prescriptsExitCode == null) throw Error("this._prescriptsExitCode must be defined!");

        await this.execAfterScripts(expanded);

        this._running = false;
        this._endTime = this._endTime ?? process.hrtime(this._startTime);
        this.printFinishedString();

        await this.copyCacheOut(this.writeStreams, expanded);
        await this.copyArtifactsOut(this.writeStreams, expanded);

        if (this.jobData["coverage"]) {
            this._coveragePercent = await Utils.getCoveragePercent(argv.cwd, argv.stateDir, this.jobData["coverage"], safeJobName);
        }
    }

    async cleanupResources () {
        clearTimeout(this._longRunningSilentTimeout);

        if (!this.argv.cleanup) return;

        if (this._containersToClean.length > 0) {
            try {
                await Utils.spawn([this.argv.containerExecutable, "rm", "-vf", ...this._containersToClean]);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
            }
        }

        if (this._serviceNetworkId) {
            try {
                await Utils.spawn([this.argv.containerExecutable, "network", "rm", `${this._serviceNetworkId}`]);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
            }
        }

        if (this._containerVolumeNames.length > 0) {
            try {
                await Utils.spawn([this.argv.containerExecutable, "volume", "rm", ...this._containerVolumeNames]);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
            }
        }

        const rmPromises = [];
        for (const file of this._filesToRm) {
            rmPromises.push(fs.rm(file, {recursive: true, force: true}));
        }
        await Promise.all(rmPromises);

        const fileVariablesDir = this.fileVariablesDir;
        try {
            await fs.rm(fileVariablesDir, {recursive: true, force: true});
        } catch (e) {
            assert(e instanceof Error, "e is not instanceof Error");
        }
    }

    private generateInjectSSHAgentOptions () {
        if (!this.injectSSHAgent) {
            return "";
        }
        if (process.platform === "darwin" || /^darwin/.exec(process.env.OSTYPE ?? "")) {
            return "--env SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock -v /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock";
        }
        return `--env SSH_AUTH_SOCK=${process.env.SSH_AUTH_SOCK} -v ${process.env.SSH_AUTH_SOCK}:${process.env.SSH_AUTH_SOCK}`;
    }

    private generateScriptCommands (scripts: string[]) {
        let cmd = "";
        scripts.forEach((script) => {
            const split = script.split(/\r?\n/);
            const multilineText = split.length > 1 ? " # collapsed multi-line command" : "";
            const text = split[0]?.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[$]/g, "\\$");
            if (this.interactive) {
                cmd += chalk`echo "{green $ ${text}${multilineText}}"\n`;
            } else {
                // Print command echo'ed with $GCL_SHELL_PROMPT_PLACEHOLDER
                cmd += `echo "${GCL_SHELL_PROMPT_PLACEHOLDER} ${text}${multilineText}"\n`;
            }
            // Execute actual script
            cmd += `${script}\n`;
        });
        return cmd;
    }

    private async mountCacheCmd (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        if (this.imageName(expanded) && !this.argv.mountCache) return [];

        const cmd: string[] = [];
        for (const [index, c] of this.cache.entries()) {
            const uniqueCacheName = await this.getUniqueCacheName(this.argv.cwd, expanded, index);
            c.paths.forEach((p) => {
                const path = Utils.expandText(p, expanded);
                writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright mounting cache} for path ${path}\n`);
                const cacheMount = Utils.safeDockerString(`gcl-${expanded.CI_PROJECT_PATH_SLUG}-${uniqueCacheName}`);
                cmd.push("-v", `${cacheMount}:${this.ciProjectDir}/${path}`);
            });
        }
        return cmd;
    }

    private async execPreScripts (expanded: {[key: string]: string}): Promise<void> {
        const prescripts = this.beforeScripts.concat(this.scripts);
        expanded["CI_JOB_STATUS"] = "running";

        this._prescriptsExitCode = await this.execScripts(prescripts, expanded, "");
        expanded["CI_JOB_STATUS"] = this._prescriptsExitCode === 0 ? "success" : "failed";

        this.printExitedString(this._prescriptsExitCode);
    }

    private async execAfterScripts (expanded: {[key: string]: string}): Promise<void> {
        const message = "Running after script...";
        this._afterScriptsExitCode = await this.execScripts(this.afterScripts, expanded, message);

        this.printAfterScriptExitedString(this._afterScriptsExitCode);
    }

    private async execScripts (scripts: string[], expanded: {[key: string]: string}, message: string): Promise<number> {
        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const safeJobName = this.safeJobName;
        const outputFilesPath = `${cwd}/${stateDir}/output/${safeJobName}.log`;
        const buildVolumeName = this.buildVolumeName;
        const tmpVolumeName = this.tmpVolumeName;
        const imageName = this.imageName(expanded);
        const writeStreams = this.writeStreams;

        if (scripts.length === 0 || scripts[0] == null) return 0;

        if (message.length > 0) writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright ${message}}\n`);

        await fs.remove(`${cwd}/${stateDir}/artifacts/${safeJobName}`);

        // Copy git tracked files to build folder if shell isolation enabled.
        if (!imageName && this.argv.shellIsolation) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, `${safeJobName}`);
        }

        if (this.interactive) {
            let iCmd = "set -eo pipefail\n";
            iCmd += this.generateScriptCommands(scripts);

            const interactiveCp = execa(iCmd, {
                cwd,
                shell: "bash",
                stdio: ["inherit", "inherit", "inherit"],
                env: {...expanded, ...process.env},
            });
            return new Promise<number>((resolve, reject) => {
                void interactiveCp.on("exit", (code) => resolve(code ?? 0));
                void interactiveCp.on("error", (err) => reject(err));
            });
        }

        this.refreshLongRunningSilentTimeout(writeStreams);

        if (imageName && !this._containerId) {
            let dockerCmd = `${this.argv.containerExecutable} create --interactive ${this.generateInjectSSHAgentOptions()} `;
            if (this.argv.privileged) {
                dockerCmd += "--privileged ";
            }

            if (this.argv.ulimit !== null) {
                dockerCmd += `--ulimit nofile=${this.argv.ulimit} `;
            }

            if (this.argv.umask) {
                dockerCmd += "--user 0:0 ";
            }

            if (this.argv.userns != undefined) {
                dockerCmd += `--userns=${this.argv.userns} `;
            }

            if (this.argv.containerMacAddress) {
                dockerCmd += `--mac-address "${this.argv.containerMacAddress}" `;
            }

            const imageUser = this.imageUser(expanded);
            if (imageUser) {
                dockerCmd += `--user ${imageUser} `;
            }

            if (this.argv.containerEmulate) {
                const runnerName: string = this.argv.containerEmulate;

                if (!GitlabRunnerPresetValues.includes(runnerName)) {
                    throw new Error("Invalid gitlab runner to emulate.");
                }

                const memoryConfig = GitlabRunnerMemoryPresetValue[runnerName];
                const cpuConfig = GitlabRunnerCPUsPresetValue[runnerName];

                dockerCmd += `--memory=${memoryConfig}m `;
                dockerCmd += `--kernel-memory=${memoryConfig}m `;
                dockerCmd += `--cpus=${cpuConfig} `;
            }

            // host and none networks have to be specified using --network, since they cannot be used with
            // `docker network connect`.
            for (const network of this.argv.network) {
                if (["host", "none"].includes(network)) {
                    dockerCmd += `--network ${network} `;
                }
            }
            // The default podman network mode is not `bridge`, which means a `podman network connect` call will fail
            // when connecting user defined networks. The workaround is to use a user defined network on container
            // creation.
            //
            // See https://github.com/containers/podman/issues/19577
            //
            // This should not clash with the `host` and `none` networks above, since service creation should have
            // failed when using `host` or `none` networks.
            if (this._serviceNetworkId) {
                // `build` alias: https://gitlab.com/gitlab-org/gitlab-runner/-/issues/27060
                dockerCmd += `--network ${this._serviceNetworkId} --network-alias build `;
            }

            dockerCmd += `--volume ${buildVolumeName}:${this.ciProjectDir} `;
            dockerCmd += `--volume ${tmpVolumeName}:${this.fileVariablesDir} `;
            dockerCmd += `--workdir ${this.ciProjectDir} `;

            for (const volume of this.argv.volume) {
                dockerCmd += `--volume ${volume} `;
            }

            for (const extraHost of this.argv.extraHost) {
                dockerCmd += `--add-host=${extraHost} `;
            }

            for (const [key, val] of Object.entries(expanded)) {
                // Replacing `'` with `'\''` to correctly handle single quotes(if `val` contains `'`) in shell commands
                dockerCmd += `  -e '${key}=${val.toString().replace(/'/g, "'\\''")}' \\\n`;
            }

            if (this.imageEntrypoint) {
                dockerCmd += `--entrypoint ${Utils.safeBashString(this.imageEntrypoint[0])} `;
            }

            dockerCmd += `${(await this.mountCacheCmd(writeStreams, expanded)).join(" ")} `;
            dockerCmd += `${imageName} `;

            if (this.imageEntrypoint?.length ?? 0 > 1) {
                this.imageEntrypoint?.slice(1).forEach((e) => {
                    dockerCmd += `${Utils.safeBashString(e)} `;
                });
            }

            dockerCmd += "sh -c \"\n";
            dockerCmd += "if [ -x /usr/local/bin/bash ]; then\n";
            dockerCmd += "\texec /usr/local/bin/bash \n";
            dockerCmd += "elif [ -x /usr/bin/bash ]; then\n";
            dockerCmd += "\texec /usr/bin/bash \n";
            dockerCmd += "elif [ -x /bin/bash ]; then\n";
            dockerCmd += "\texec /bin/bash \n";
            dockerCmd += "elif [ -x /usr/local/bin/sh ]; then\n";
            dockerCmd += "\texec /usr/local/bin/sh \n";
            dockerCmd += "elif [ -x /usr/bin/sh ]; then\n";
            dockerCmd += "\texec /usr/bin/sh \n";
            dockerCmd += "elif [ -x /bin/sh ]; then\n";
            dockerCmd += "\texec /bin/sh \n";
            dockerCmd += "elif [ -x /busybox/sh ]; then\n";
            dockerCmd += "\texec /busybox/sh \n";
            dockerCmd += "else\n";
            dockerCmd += "\techo shell not found\n";
            dockerCmd += "\texit 1\n";
            dockerCmd += "fi\n\"";

            const {stdout: containerId} = await Utils.bash(dockerCmd, cwd);

            for (const network of this.argv.network) {
                // Special network names that do not work with `docker network connect`
                if (["host", "none"].includes(network)) {
                    continue;
                }
                await Utils.spawn([this.argv.containerExecutable, "network", "connect", network, `${containerId}`]);
            }

            this._containerId = containerId;
            this._containersToClean.push(this._containerId);
        }

        await this.copyCacheIn(writeStreams, expanded);
        await this.copyArtifactsIn(writeStreams);

        let cmd = "set -eo pipefail\n";
        cmd += "exec 0< /dev/null\n";

        if (!imageName && this.argv.shellIsolation) {
            cmd += `cd ${stateDir}/builds/${safeJobName}/\n`;
        }

        if (imageName) {
            cmd += `cd ${this.ciProjectDir} \n`;

            if (expanded["CI_JOB_STATUS"] != "running") {
                // Ensures the env `CI_JOB_STATUS` is passed to the after_script context
                cmd += `export CI_JOB_STATUS=${expanded["CI_JOB_STATUS"]}\n`;
            }
        }
        cmd += this.generateScriptCommands(scripts);

        cmd += "exit 0\n";

        const jobScriptFile = `${cwd}/${stateDir}/scripts/${safeJobName}_${this.jobId}`;
        await fs.outputFile(jobScriptFile, cmd, "utf-8");
        await fs.chmod(jobScriptFile, "0755");
        this._filesToRm.push(jobScriptFile);

        if (imageName) {
            await Utils.spawn([this.argv.containerExecutable, "cp", `${stateDir}/scripts/${safeJobName}_${this.jobId}`, `${this._containerId}:/gcl-cmd`], cwd);
        }

        const cp = execa(this._containerId ? `${this.argv.containerExecutable} start --attach -i ${this._containerId}` : "bash", {
            cwd,
            shell: "bash",
            env: imageName ? process.env : expanded,
        });

        const outFunc = (line: string, stream: (txt: string) => void, colorize: (str: string) => string) => {
            this.refreshLongRunningSilentTimeout(writeStreams);
            stream(`${this.formattedJobName} `);
            if (line.startsWith(GCL_SHELL_PROMPT_PLACEHOLDER)) {
                // replace the GCL_SHELL_PROMPT_PLACEHOLDER with `$` and make the SHELL_PROMPT line green color
                line = line.slice(GCL_SHELL_PROMPT_PLACEHOLDER.length);
                line = chalk`{green $${line}}`;
            } else {
                stream(`${colorize(">")} `);
            }
            stream(`${line}\n`);
            fs.appendFileSync(outputFilesPath, `${line}\n`);
        };

        const quiet = this.argv.quiet;

        return await new Promise<number>((resolve, reject) => {
            if (!quiet) {
                cp.stdout?.pipe(split2()).on("data", (e: string) => outFunc(e, writeStreams.stdout.bind(writeStreams), (s) => chalk`{greenBright ${s}}`));
                cp.stderr?.pipe(split2()).on("data", (e: string) => outFunc(e, writeStreams.stderr.bind(writeStreams), (s) => chalk`{redBright ${s}}`));
            }
            void cp.on("exit", (code) => {
                clearTimeout(this._longRunningSilentTimeout);
                return resolve(code ?? 0);},
            );
            void cp.on("error", (err) => {
                clearTimeout(this._longRunningSilentTimeout);
                return reject(err);
            });

            if (imageName) {
                cp.stdin?.end(". /gcl-cmd");
            } else {
                cp.stdin?.end(`./${stateDir}/scripts/${safeJobName}_${this.jobId}`);
            }
        });
    }

    private imageName (vars: {[key: string]: string} = {}): string | null {
        if (this.argv.forceShellExecutor) {
            return null;
        }
        const image = this.jobData["image"];
        if (!image) {
            if (this.argv.shellExecutorNoImage) {
                return null;
            } else {
                // https://docs.gitlab.com/ee/ci/runners/hosted_runners/linux.html#container-images
                return this.argv.defaultImage;
            }
        }
        const expanded = Utils.expandVariables(vars);
        const imageName = Utils.expandText(image.name, expanded);
        return imageName.includes(":") ? imageName : `${imageName}:latest`;
    }

    private imageUser (vars: {[key: string]: string} = {}): string | null {
        const image = this.jobData["image"];
        if (!image) return null;
        if (!image["docker"]) return null;
        return Utils.expandText(image["docker"]["user"], vars);
    }

    get imageEntrypoint (): string[] | null {
        const image = this.jobData["image"];

        if (!image?.entrypoint) {
            return null;
        }
        assert(Array.isArray(image.entrypoint), "image:entrypoint must be an array");
        return image.entrypoint;
    }

    private async validateCiDependencyProxyServerAuthentication (imageName: string) {
        const CI_DEPENDENCY_PROXY_SERVER = this._variables["CI_DEPENDENCY_PROXY_SERVER"];
        if (!imageName.startsWith(CI_DEPENDENCY_PROXY_SERVER)) {
            return;
        }
        try {
            await Utils.spawn([this.argv.containerExecutable, "login", CI_DEPENDENCY_PROXY_SERVER]);
        } catch (e: any) {
            const errMsg = `Please authenticate to the Dependency Proxy (${CI_DEPENDENCY_PROXY_SERVER}) https://docs.gitlab.com/ee/user/packages/dependency_proxy/#authenticate-with-the-dependency-proxy`;
            if (this.argv.containerExecutable == "docker") {
                assert(!e.stderr.includes("Cannot perform an interactive login"), errMsg);
            } else if (this.argv.containerExecutable == "podman") {
                assert(!e.stderr.includes("Username: Error: getting username and password: reading username: EOF"), errMsg);
            }
            throw e;
        }
    }

    private async pullImage (writeStreams: WriteStreams, imageToPull: string) {
        const pullPolicy = this.argv.pullPolicy;
        const actualPull = async () => {
            await this.validateCiDependencyProxyServerAuthentication(imageToPull);
            const time = process.hrtime();
            await Utils.spawn([this.argv.containerExecutable, "pull", imageToPull]);
            const endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright pulled} ${imageToPull} in {magenta ${prettyHrtime(endTime)}}\n`);
            this.refreshLongRunningSilentTimeout(writeStreams);
        };

        if (pullPolicy === "always") {
            await actualPull();
            return;
        }
        try {
            await Utils.spawn([this.argv.containerExecutable, "image", "inspect", imageToPull]);
        } catch {
            await actualPull();
        }
    }

    private async initProducerReportsDotenvVariables (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const producers = this.producers;
        let producerReportsEnvs = {};
        for (const producer of producers ?? []) {
            const producerDotenv = Utils.expandText(producer.dotenv, expanded);
            if (producerDotenv === null) continue;

            const safeProducerName = Utils.safeDockerString(producer.name);
            const dotenvFolder = `${cwd}/${stateDir}/artifacts/${safeProducerName}/.gitlab-ci-reports/dotenv/`;
            if (await fs.pathExists(dotenvFolder)) {
                const dotenvFiles = (await Utils.spawn(["find", ".", "-type", "f"], dotenvFolder)).stdout.split("\n");
                for (const dotenvFile of dotenvFiles) {
                    if (dotenvFile == "") continue;
                    const producerReportEnv = dotenv.parse(await fs.readFile(`${dotenvFolder}/${dotenvFile}`));
                    producerReportsEnvs = {...producerReportsEnvs, ...producerReportEnv};
                }
            } else {
                writeStreams.stderr(chalk`${this.formattedJobName} {yellow reports.dotenv produced by '${producer.name}' could not be found}\n`);
            }

        }
        return producerReportsEnvs;
    }

    private async copyCacheIn (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        if (this.argv.mountCache && this.imageName(expanded)) return;
        if ((!this.imageName(expanded) && !this.argv.shellIsolation) || this.cache.length === 0) return;

        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;

        for (const [index, c] of this.cache.entries()) {
            if (!["pull", "pull-push"].includes(c.policy)) return;

            const time = process.hrtime();
            const cacheName = await this.getUniqueCacheName(cwd, expanded, index);
            const cacheFolder = `${cwd}/${stateDir}/cache/${cacheName}`;
            if (!await fs.pathExists(cacheFolder)) {
                continue;
            }

            await Mutex.exclusive(cacheName, async () => {
                await this.copyIn(cacheFolder);
            });
            const endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright imported cache '${cacheName}'} in {magenta ${prettyHrtime(endTime)}}\n`);
        }
    }

    private async copyArtifactsIn (writeStreams: WriteStreams) {
        if ((!this.imageName(this._variables) && !this.argv.shellIsolation) || (this.producers ?? []).length === 0) return;

        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const time = process.hrtime();
        const promises = [];
        for (const producer of this.producers ?? []) {
            const producerSafeName = Utils.safeDockerString(producer.name);
            const artifactFolder = `${cwd}/${stateDir}/artifacts/${producerSafeName}`;
            if (!await fs.pathExists(artifactFolder)) {
                await fs.mkdirp(artifactFolder);
            }

            const readdir = await fs.readdir(artifactFolder);
            if (readdir.length === 0) {
                writeStreams.stderr(chalk`${this.formattedJobName} {yellow artifacts from {blueBright ${producerSafeName}} was empty}\n`);
            }

            promises.push(this.copyIn(artifactFolder));
        }
        await Promise.all(promises);
        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright imported artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
    }

    copyIn (source: string) {
        const safeJobName = this.safeJobName;
        if (!this.imageName(this._variables) && this.argv.shellIsolation) {
            return Utils.spawn(["rsync", "-a", `${source}/.`, `${this.argv.cwd}/${this.argv.stateDir}/builds/${safeJobName}`]);
        }
        return Utils.spawn([this.argv.containerExecutable, "cp", `${source}/.`, `${this._containerId}:${this.ciProjectDir}`]);
    }

    private async copyCacheOut (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        if (this.argv.mountCache && this.imageName(expanded)) return;
        if ((!this.imageName(expanded) && !this.argv.shellIsolation) || this.cache.length === 0) return;

        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const cachePath = this.imageName(expanded) ? "/cache" : "../../cache";

        let time, endTime;
        for (const [index, c] of this.cache.entries()) {
            if (!["push", "pull-push"].includes(c.policy)) return;
            if ("on_success" === c.when && this.jobStatus !== "success") return;
            if ("on_failure" === c.when && this.jobStatus === "success") return;
            const cacheName = await this.getUniqueCacheName(cwd, expanded, index);

            let paths = "";
            for (const path of c.paths) {
                if (!Utils.isSubpath(path, this.argv.cwd, this.argv.cwd)) continue;

                paths += " " + Utils.expandText(path, expanded).replace(`${expanded.CI_PROJECT_DIR}/`, "");
            }

            time = process.hrtime();
            let cmd = "shopt -s globstar nullglob dotglob\n";
            cmd += `mkdir -p ${Utils.safeBashString(cachePath + "/" + cacheName)}\n`;
            cmd += `rsync -Ra ${paths} ${Utils.safeBashString(cachePath + "/" + cacheName + "/.")} || true\n`;

            await Mutex.exclusive(cacheName, async () => {
                await this.copyOut(cmd, stateDir, "cache", []);
            });
            endTime = process.hrtime(time);

            for (const __path of c.paths) {
                const _path = Utils.expandText(__path, expanded);
                if (!Utils.isSubpath(_path, this.argv.cwd, this.argv.cwd)) {
                    writeStreams.stdout(chalk`{yellow WARNING: processPath: artifact path is not a subpath of project directory: ${_path}}\n`);
                    continue;
                }

                let path = _path;
                if (globby.hasMagic(path) && !path.endsWith("*")) {
                    path = `${path}/**`;
                }

                let numOfFiles = globby.sync(path, {
                    dot: true,
                    onlyFiles: false,
                    cwd: `${this.argv.cwd}/${stateDir}/cache/${cacheName}`,
                }).length;

                if (numOfFiles == 0) {
                    writeStreams.stdout(chalk`{yellow WARNING: ${path}: no matching files. Ensure that the artifact path is relative to the working directory}\n`);
                    continue;
                }

                if (!globby.hasMagic(path)) numOfFiles++; // add one because the pattern itself is a folder

                writeStreams.stdout(`${_path}: found ${numOfFiles} artifact files and directories\n`);
            }
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright cache created in '${stateDir}/cache/${cacheName}'} in {magenta ${prettyHrtime(endTime)}}\n`);
        }
    }

    private async copyArtifactsOut (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        // TODO: update the condition to support when:on_success / when:on_failure
        if (this.jobStatus !== "success" && this.artifacts?.when !== "always") return;
        if (!this.artifacts) return;
        if ((this.artifacts.paths?.length ?? 0) === 0 && this.artifacts.reports?.dotenv == null) return;

        const safeJobName = this.safeJobName;
        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        let artifactsPath: string;

        if (!this.argv.shellIsolation && !this.imageName(expanded)) {
            artifactsPath = `${stateDir}/artifacts`;
        } else if (this.imageName(expanded)) {
            artifactsPath = "/artifacts";
        } else {
            artifactsPath = "../../artifacts";
        }

        let time, endTime;
        let cpCmd = "shopt -s globstar nullglob dotglob\n";
        cpCmd += `mkdir -p ${artifactsPath}/${safeJobName}\n`;
        cpCmd += "rsync --exclude '.gitlab-ci-local/**' -Ra ";
        for (const artifactExcludePath of this.artifacts?.exclude ?? []) {
            const expandedPath = Utils.expandText(artifactExcludePath, expanded).replace(`${expanded.CI_PROJECT_DIR}/`, "");
            cpCmd += `--exclude '${expandedPath}' `;
        }
        for (const artifactPath of this.artifacts?.paths ?? []) {
            const expandedPath = Utils.expandText(artifactPath, expanded).replace(`${expanded.CI_PROJECT_DIR}/`, "");
            cpCmd += `${expandedPath} `;
        }
        cpCmd += `${artifactsPath}/${safeJobName}/. || true\n`;
        const reportDotenv = Utils.expandText(this.artifacts.reports?.dotenv ?? null, expanded);
        const reportDotenvs: string[] | null = (typeof reportDotenv === "string") ? // normalize to string[] for easier handling
            [reportDotenv] :
            reportDotenv;
        if (reportDotenvs != null) {
            reportDotenvs.forEach((reportDotenv) => {
                cpCmd += `mkdir -p ${artifactsPath}/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
                cpCmd += `if [ -f ${reportDotenv} ]; then\n`;
                cpCmd += `  rsync -Ra ${reportDotenv} ${artifactsPath}/${safeJobName}/.gitlab-ci-reports/dotenv/.\n`;
                cpCmd += "fi\n";
            });
        }

        time = process.hrtime();
        const dockerCmdExtras = this.argv.mountCache ? await this.mountCacheCmd(writeStreams, expanded) : [];
        await this.copyOut(cpCmd, stateDir, "artifacts", dockerCmdExtras);
        endTime = process.hrtime(time);

        for (const reportDotenv of reportDotenvs ?? []) {
            if (await fs.pathExists(`${cwd}/${stateDir}/artifacts/${safeJobName}/.gitlab-ci-reports/dotenv/${reportDotenv}`)) continue;
            writeStreams.stderr(chalk`${this.formattedJobName} {yellow artifact reports dotenv '${reportDotenv}' could not be found}\n`);
        }

        const readdir = await fs.readdir(`${cwd}/${stateDir}/artifacts/${safeJobName}`);
        if (readdir.length === 0) {
            writeStreams.stdout(chalk`${this.formattedJobName} {yellow !! no artifacts was copied !!}\n`);
        } else {
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright exported artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        if (this.artifactsToSource && (this.argv.shellIsolation || this.imageName(expanded))) {
            time = process.hrtime();
            await Utils.spawn(["rsync", "--exclude=/.gitlab-ci-reports/", "-a", `${cwd}/${stateDir}/artifacts/${safeJobName}/.`, cwd]);
            if (reportDotenv != null) {
                await Utils.spawn(["rsync", "-a", `${cwd}/${stateDir}/artifacts/${safeJobName}/.gitlab-ci-reports/dotenv/.`, cwd]);
            }
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright copied artifacts to cwd} in {magenta ${prettyHrtime(endTime)}}\n`);
        }
    }

    private async copyOut (cmd: string, stateDir: string, type: "artifacts" | "cache", dockerCmdExtras: string[]) {
        const safeJobName = this.safeJobName;
        const buildVolumeName = this.buildVolumeName;
        const cwd = this.argv.cwd;
        const helperImageName = this.argv.helperImage;

        await fs.mkdirp(`${cwd}/${stateDir}/${type}`);

        if (this.imageName(this._variables)) {
            const {stdout: containerId} = await Utils.bash(`${this.argv.containerExecutable} create -i ${dockerCmdExtras.join(" ")} -v ${buildVolumeName}:${this.ciProjectDir} -w ${this.ciProjectDir} ${helperImageName} bash -c "${cmd.replace(/"/g, "\\\"")}"`, cwd);
            this._containersToClean.push(containerId);
            await Utils.spawn([this.argv.containerExecutable, "start", containerId, "--attach"]);
            await Utils.spawn([this.argv.containerExecutable, "cp", `${containerId}:/${type}/.`, `${stateDir}/${type}/.`], cwd);
        } else if (this.argv.shellIsolation) {
            await Utils.bash(`bash -eo pipefail -c "${cmd}"`, `${cwd}/${stateDir}/builds/${safeJobName}`);
        } else if (!this.argv.shellIsolation) {
            await Utils.bash(`bash -eo pipefail -c "${cmd}"`, `${cwd}`);
        }
    }

    private refreshLongRunningSilentTimeout (writeStreams: WriteStreams) {
        clearTimeout(this._longRunningSilentTimeout);
        this._longRunningSilentTimeout = setTimeout(() => {
            writeStreams.stdout(chalk`${this.formattedJobName} {grey > still running...}\n`);
            this.refreshLongRunningSilentTimeout(writeStreams);
        }, 10000);
    }

    private getFinishedString () {
        return chalk`${this.formattedJobName} {magentaBright finished} in {magenta ${this.prettyDuration}}`;
    }

    private printFinishedString () {
        if (this.jobStatus !== "success") return;
        this.writeStreams.stdout(`${this.getFinishedString()}\n`);
    }

    private printExitedString (code: number) {
        const writeStreams = this.writeStreams;
        const finishedStr = this.getFinishedString();

        // Won't print if jobStatus is "success" because that will be printed via the `printFinishedString()`
        if (this.jobStatus === "warning") {
            writeStreams.stderr(
                chalk`${finishedStr} {black.bgYellowBright  WARN ${code.toString()} }\n`,
            );
        } else if (this.jobStatus === "failed") {
            writeStreams.stderr(
                chalk`${finishedStr} {black.bgRed  FAIL ${code.toString()} }\n`,
            );
        }
    }

    private printAfterScriptExitedString (code: number) {
        const writeStreams = this.writeStreams;
        const finishedStr = this.getFinishedString();

        if (code !== 0) {
            writeStreams.stderr(
                chalk`${finishedStr} {black.bgYellowBright  WARN ${code.toString()} } after_script\n`,
            );
        }
    }

    private async createDockerNetwork (networkName: string) {
        const {stdout: networkId} = await Utils.spawn([this.argv.containerExecutable, "network", "create", `${networkName}`]);
        this._serviceNetworkId = networkId;
    }

    private async startService (writeStreams: WriteStreams, expanded: {[key: string]: string}, service: Service) {
        const cwd = this.argv.cwd;
        let dockerCmd = `${this.argv.containerExecutable} create --interactive `;
        this.refreshLongRunningSilentTimeout(writeStreams);

        if (this.argv.umask) {
            dockerCmd += "--user 0:0 ";
        }

        if (this.argv.userns != undefined) {
            dockerCmd += `--userns=${this.argv.userns} `;
        }

        if (this.argv.privileged) {
            dockerCmd += "--privileged ";
        }

        if (this.argv.ulimit !== null) {
            dockerCmd += `--ulimit nofile=${this.argv.ulimit} `;
        }

        for (const volume of this.argv.volume) {
            dockerCmd += `--volume ${volume} `;
        }

        for (const extraHost of this.argv.extraHost) {
            dockerCmd += `--add-host=${extraHost} `;
        }

        const serviceAlias = service.alias;
        const serviceName = service.name;
        const serviceNameWithoutVersion = serviceName.replace(/(.*)(:.*)/, "$1");
        const aliases = new Set<string>();
        aliases.add(serviceNameWithoutVersion.replaceAll("/", "-"));
        aliases.add(serviceNameWithoutVersion.replaceAll("/", "__"));
        if (serviceAlias) {
            aliases.add(serviceAlias);
        }

        for (const [key, val] of Object.entries(expanded)) {
            // Replacing `'` with `'\''` to correctly handle single quotes(if `val` contains `'`) in shell commands
            dockerCmd += `  -e '${key}=${val.toString().replace(/'/g, "'\\''")}' \\\n`;
        }

        const serviceEntrypoint = service.entrypoint;
        if (serviceEntrypoint) {
            dockerCmd += `--entrypoint ${Utils.safeBashString(serviceEntrypoint[0])} `;
        }
        dockerCmd += `--volume ${this.buildVolumeName}:${this.ciProjectDir} `;
        dockerCmd += `--volume ${this.tmpVolumeName}:${this.fileVariablesDir} `;

        // The default podman network mode is not `bridge`, which means a `podman network connect` call will fail
        // when connecting user defined networks. The workaround is to use a user defined network on container
        // creation.
        //
        // See https://github.com/containers/podman/issues/19577
        dockerCmd += `--network ${this._serviceNetworkId} `;
        for (const alias of aliases) {
            dockerCmd += `--network-alias ${alias} `;
        }

        dockerCmd += `${serviceName} `;

        if (serviceEntrypoint?.length ?? 0 > 1) {
            serviceEntrypoint?.slice(1).forEach((e) => {
                dockerCmd += `${Utils.safeBashString(e)} `;
            });
        }
        (service.command ?? []).forEach((e) => dockerCmd += `"${e.replace(/\$/g, "\\$")}" `);

        const time = process.hrtime();

        const {stdout: containerId} = await Utils.bash(dockerCmd, cwd);
        this._containersToClean.push(containerId);

        for (const network of this.argv.network) {
            await Utils.spawn([this.argv.containerExecutable, "network", "connect", network, `${containerId}`]);
        }

        await Utils.spawn([this.argv.containerExecutable, "start", `${containerId}`]);

        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright started service image: ${serviceName} with aliases: ${Array.from(aliases).join(", ")}} in {magenta ${prettyHrtime(endTime)}}\n`);

        return containerId;
    }

    private async serviceHealthCheck (writeStreams: WriteStreams, service: Service, serviceIndex: number, serviceContainerLogFile: string) {
        const serviceAlias = service.alias;
        const serviceName = service.name;

        const {stdout} = await Utils.spawn([this.argv.containerExecutable, "image", "inspect", serviceName]);
        const imageInspect = JSON.parse(stdout);

        // Copied from the startService block. Important thing is that the aliases match
        const serviceNameWithoutVersion = serviceName.replace(/(.*)(:.*)/, "$1");
        const aliases = [serviceNameWithoutVersion.replaceAll("/", "-"), serviceNameWithoutVersion.replaceAll("/", "__")];
        if (serviceAlias) {
            aliases.push(serviceAlias);
        }

        const uniqueAlias = aliases[aliases.length - 1];

        if ((imageInspect[0]?.Config?.ExposedPorts ?? null) === null) {
            return writeStreams.stderr(chalk`${this.formattedJobName} {yellow Could not find exposed tcp ports ${serviceName}}\n`);
        }

        const time = process.hrtime();
        try {
            // Iterate over each port defined in the image, and try to connect to the alias
            await Promise.any(Object.keys(imageInspect[0].Config.ExposedPorts).map((port) => {
                if (!port.endsWith("/tcp")) return;
                const portNum = parseInt(port.replace("/tcp", ""));
                const containerName = `gcl-wait-for-it-${this.jobId}-${serviceIndex}-${portNum}`;
                const spawnCmd = [this.argv.containerExecutable, "run", "--rm", `--name=${containerName}`, "--network", `${this._serviceNetworkId}`, "docker.io/sumina46/wait-for-it", `${uniqueAlias}:${portNum}`, "-t", "30"];
                this._containersToClean.push(containerName);
                return Utils.spawn(spawnCmd);
            }));
            const endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.formattedJobName} {greenBright service image: ${serviceName} healthcheck passed in {green ${prettyHrtime(endTime)}}}\n`);
        } catch (e: any) {
            if (!(e instanceof AggregateError)) throw e;
            e.errors.forEach((singleError: Error) => {
                writeStreams.stdout(chalk`${this.formattedJobName} {redBright service image: ${serviceName} healthcheck failed}\n`);
                singleError.message.split(/\r?\n/g).forEach((line: string) => {
                    writeStreams.stdout(chalk`${this.formattedJobName} {redBright   ${line}}\n`);
                });
                writeStreams.stdout(chalk`${this.formattedJobName} {redBright also see (${serviceContainerLogFile})}\n`);
            });
        } finally {
            // Kill all wait-for-it containers, when one have been successful
            await Promise.allSettled(Object.keys(imageInspect[0].Config.ExposedPorts).map((port) => {
                if (!port.endsWith("/tcp")) return;
                const portNum = parseInt(port.replace("/tcp", ""));
                return Utils.spawn([this.argv.containerExecutable, "rm", "-vf", `gcl-wait-for-it-${this.jobId}-${serviceIndex}-${portNum}`]);
            }));
        }
    }

    private async fetchTriggerInclude () {
        const {cwd, stateDir} = this.argv;

        fs.mkdirpSync(`${cwd}/${stateDir}/includes/triggers`);

        let contents: any = {};

        for (const include of this.jobData.trigger?.include ?? []) {
            if (include["local"]) {
                const expandedInclude = Utils.expandText(include["local"], this._variables);
                validateIncludeLocal(expandedInclude);
                const files = await resolveIncludeLocal(expandedInclude, cwd);
                if (files.length == 0) {
                    throw new AssertionError({message: `Local include file \`${include["local"]}\` specified in \`.${this.name}\` cannot be found!`});
                }

                for (const file of files) {
                    const content = await Parser.loadYaml(file, {});
                    contents = {
                        ...contents,
                        ...content,
                    };
                }
            } else if (include["artifact"]) {
                const content = await Parser.loadYaml(`${cwd}/${stateDir}/artifacts/${include["job"]}/${include["artifact"]}`, {});
                contents = {
                    ...contents,
                    ...content,
                };
            } else if (include["project"]) {
                this.writeStreams.memoStdout(chalk`{bgYellowBright  WARN } \`{blueBright ${this.name}.trigger.include.*.project}\` will be no-op. It is currently not implemented\n`);

            } else if (include["template"]) {
                this.writeStreams.memoStdout(chalk`{bgYellowBright  WARN } \`{blueBright ${this.name}.trigger.include.*.template}\` will be no-op. It is currently not implemented\n`);
            }
        }
        const target = `${cwd}/${stateDir}/includes/triggers/${this.name}.yml`;
        fs.writeFileSync(target, yaml.dump(contents));
    }
}

export async function cleanupJobResources (jobs?: Iterable<Job>) {
    if (!jobs) return;
    const promises = [];
    for (const job of jobs) {
        promises.push(job.cleanupResources());
    }
    await Promise.all(promises);
}
