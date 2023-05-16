import chalk from "chalk";
import * as dotenv from "dotenv";
import * as fs from "fs-extra";
import prettyHrtime from "pretty-hrtime";
import split2 from "split2";
import {Utils} from "./utils";
import {WriteStreams} from "./write-streams";
import {GitData} from "./git-data";
import assert, {AssertionError} from "assert";
import {Mutex} from "./mutex";
import {Argv} from "./argv";
import execa from "execa";
import {CICDVariable} from "./variables-from-files";

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

interface Need {
    job: string;
    artifacts: boolean;
    optional: boolean;
    pipeline: string | null;
    project: string | null;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    year: undefined,
    month: undefined,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
});

export class Job {

    static readonly illegalJobNames = new Set([
        "include", "local_configuration", "image", "services",
        "stages", "types", "before_script", "default",
        "after_script", "variables", "cache", "workflow",
    ]);

    readonly argv: Argv;
    readonly name: string;
    readonly baseName: string;
    readonly dependencies: string[] | null;
    readonly environment?: {name: string; url: string | null};
    readonly jobId: number;
    readonly rules?: {
        if: string;
        when: string;
        exists: string[];
        allow_failure: boolean;
        variables: {[key: string]: string};
    }[];

    readonly allowFailure: boolean;
    readonly when: string;
    readonly exists: string[];
    readonly pipelineIid: number;
    readonly gitData: GitData;

    private readonly _variables: {[key: string]: string} = {};
    private _prescriptsExitCode: number | null = null;
    private _afterScriptsExitCode = 0;
    private _coveragePercent: string | null = null;
    private _running = false;
    private _containerId: string | null = null;
    private _serviceNetworkId: string | null = null;
    private _containerVolumeNames: string[] = [];
    private _longRunningSilentTimeout: NodeJS.Timeout = -1 as any;
    private _producers: {name: string; dotenv: string | null}[] | null = null;
    private _jobNamePad: number | null = null;

    private _containersToClean: string[] = [];
    private _startTime?: [number, number];
    private _endTime?: [number, number];

    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;

    constructor (opt: JobOptions) {
        const jobData = opt.data;
        const gitData = opt.gitData;
        const globalVariables = opt.globalVariables;
        const variablesFromFiles = opt.variablesFromFiles;
        const argv = opt.argv;
        const cwd = argv.cwd;
        const stateDir = argv.stateDir;
        const argvVariables = argv.variable;
        const predefinedVariables = opt.predefinedVariables;

        this.argv = argv;
        this.writeStreams = opt.writeStreams;
        this.gitData = opt.gitData;
        this.name = opt.name;
        this.baseName = opt.baseName;
        this.jobId = Math.floor(Math.random() * 1000000);
        this.jobData = opt.data;
        this.pipelineIid = opt.pipelineIid;

        this.when = jobData.when || "on_success";
        this.exists = jobData.exists || [];
        this.allowFailure = jobData.allow_failure ?? false;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;

        const matrixVariables = opt.matrixVariables ?? {};
        this._variables = {...globalVariables || {}, ...jobData.variables || {}, ...matrixVariables, ...predefinedVariables, ...argvVariables};

        let ciProjectDir = `${cwd}`;
        if (this.jobData["image"]) {
            ciProjectDir = "/gcl-builds";
        } else if (argv.shellIsolation) {
            ciProjectDir = `${cwd}/${stateDir}/builds/${this.safeJobName}`;
        }

        predefinedVariables["CI_JOB_ID"] = `${this.jobId}`;
        predefinedVariables["CI_PIPELINE_ID"] = `${this.pipelineIid + 1000}`;
        predefinedVariables["CI_PIPELINE_IID"] = `${this.pipelineIid}`;
        predefinedVariables["CI_JOB_NAME"] = `${this.name}`;
        predefinedVariables["CI_JOB_NAME_SLUG"] = `${this.name.replace(/[^a-z\d]+/ig, "-").replace(/^-/, "").slice(0, 63).replace(/-$/, "").toLowerCase()}`;
        predefinedVariables["CI_JOB_STAGE"] = `${this.stage}`;
        predefinedVariables["CI_PROJECT_DIR"] = ciProjectDir;
        predefinedVariables["CI_JOB_URL"] = `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}/-/jobs/${this.jobId}`; // Changes on rerun.
        predefinedVariables["CI_PIPELINE_URL"] = `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}/pipelines/${this.pipelineIid}`;
        predefinedVariables["CI_ENVIRONMENT_NAME"] = this.environment?.name ?? "";
        predefinedVariables["CI_ENVIRONMENT_SLUG"] = this.environment?.name?.replace(/[^a-z\d]+/ig, "-").replace(/^-/, "").slice(0, 23).replace(/-$/, "").toLowerCase() ?? "";
        predefinedVariables["CI_ENVIRONMENT_URL"] = this.environment?.url ?? "";
        predefinedVariables["CI_NODE_INDEX"] = `${opt.nodeIndex}`;
        predefinedVariables["CI_NODE_TOTAL"] = `${opt.nodesTotal}`;
        predefinedVariables["CI_REGISTRY"] = `local-registry.${this.gitData.remote.host}`;
        predefinedVariables["CI_REGISTRY_IMAGE"] = `$CI_REGISTRY/${this._variables["CI_PROJECT_PATH"]}`;

        // Find environment matched variables
        if (this.environment) {
            const expanded = Utils.expandVariables(this._variables);
            this.environment.name = Utils.expandText(this.environment.name, expanded);
            this.environment.url = Utils.expandText(this.environment.url, expanded);
        }
        const envMatchedVariables = Utils.findEnvMatchedVariables(variablesFromFiles, this.fileVariablesDir, this.environment);

        // Merge and expand after finding env matched variables
        this._variables = {...globalVariables || {}, ...jobData.variables || {}, ...matrixVariables, ...predefinedVariables, ...envMatchedVariables, ...argvVariables};

        // Set {when, allowFailure} based on rules result
        if (this.rules) {
            const ruleResult = Utils.getRulesResult({cwd, rules: this.rules, variables: this._variables});
            this.when = ruleResult.when;
            this.allowFailure = ruleResult.allowFailure;
            this._variables = {...globalVariables || {}, ...jobData.variables || {}, ...ruleResult.variables, ...matrixVariables, ...predefinedVariables, ...envMatchedVariables, ...argvVariables};
        }
        // Delete variables the user intentionally wants unset
        for (const unsetVariable of argv.unsetVariables) {
            delete this._variables[unsetVariable];
        }

        assert(this.scripts || this.trigger, chalk`{blueBright ${this.name}} must have script specified`);

        if (this.interactive && (this.when !== "manual" || this.imageName !== null)) {
            throw new AssertionError({message: `${this.formattedJobName} @Interactive decorator cannot have image: and must be when:manual`});
        }

        if (this.injectSSHAgent && this.imageName === null) {
            throw new AssertionError({message: `${this.formattedJobName} @InjectSSHAgent can only be used with image:`});
        }

        for (const [i, c] of Object.entries<any>(this.cache)) {
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

        if (this.imageName && argv.mountCache) {
            const expanded = Utils.expandVariables(this._variables);
            for (const c of this.cache) {
                c.paths.forEach((p) => {
                    const path = Utils.expandText(p, expanded);
                    assert(!path.includes("*"), chalk`{blue ${this.name}} cannot have * in cache paths, when --mount-cache is enabled`);
                });
            }
        }
    }

    get artifactsToSource () {
        if (this.jobData["artifactsToSource"] != null) return this.jobData["artifactsToSource"];
        return this.argv.artifactsToSource;
    }

    get prettyDuration () {
        if (this._endTime) {
            return prettyHrtime(this._endTime);
        }

        return this._startTime
            ? prettyHrtime(process.hrtime(this._startTime))
            : "0 ms";
    }

    get formattedJobName () {
        const timestampPrefix = this.argv.showTimestamps
            ? `[${dateFormatter.format(new Date())} ${this.prettyDuration.padStart(7)}] `
            : "";

        // [16:33:19 1.37 min] my-job     > hello world
        return chalk`${timestampPrefix}{blueBright ${this.name.padEnd(this.jobNamePad)}}`;
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

    get imageName (): string | null {
        const image = this.jobData["image"];
        if (!image) return null;
        const expanded = Utils.expandVariables(this._variables);
        const imageName = Utils.expandText(image.name, expanded);
        return imageName.includes(":") ? imageName : `${imageName}:latest`;
    }

    get imageEntrypoint (): string[] | null {
        const image = this.jobData["image"];

        if (!image?.entrypoint) {
            return null;
        }
        assert(Array.isArray(image.entrypoint), "image:entrypoint must be an array");
        return image.entrypoint;
    }

    get services (): Service[] {
        const services: Service[] = [];
        if (!this.jobData["services"]) return [];

        for (const service of Object.values<any>(this.jobData["services"])) {
            const expanded = Utils.expandVariables({...this._variables, ...service["variables"]});
            let serviceName = Utils.expandText(service["name"], expanded);
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
        return this.jobData["interactive"] || false;
    }

    get injectSSHAgent (): boolean {
        return this.jobData["injectSSHAgent"] || false;
    }

    get description (): string {
        return this.jobData["description"] ?? "";
    }

    get artifacts (): {paths: string[]; exclude?: string[]; reports?: {dotenv?: string}; when?: string} | null {
        return this.jobData["artifacts"];
    }

    get cache (): Cache[] {
        return this.jobData["cache"] || [];
    }

    public async getUniqueCacheName (cwd: string, expanded: {[key: string]: string}, key: any) {
        if (typeof key === "string" || key == null) {
            return Utils.expandText(key ?? "default", expanded);
        }
        return "md-" + await Utils.checksumFiles(key["files"].map((f: any) => {
            return `${cwd}/${Utils.expandText(f, expanded)}`;
        }));
    }

    get beforeScripts (): string[] {
        return this.jobData["before_script"] || [];
    }

    get afterScripts (): string[] {
        return this.jobData["after_script"] || [];
    }

    get scripts (): string[] {
        return this.jobData["script"];
    }

    get trigger (): any {
        return this.jobData["trigger"];
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

    async start (): Promise<void> {
        this._running = true;

        const argv = this.argv;
        this._startTime = process.hrtime();
        const writeStreams = this.writeStreams;
        const reportsDotenvVariables = await this.initProducerReportsDotenvVariables(writeStreams, Utils.expandVariables(this._variables));
        const expanded = Utils.expandVariables({...this._variables, ...reportsDotenvVariables});
        const safeJobName = this.safeJobName;


        const outputLogFilePath = `${argv.cwd}/${argv.stateDir}/output/${safeJobName}.log`;
        await fs.ensureFile(outputLogFilePath);
        await fs.truncate(outputLogFilePath);

        if (!this.interactive) {
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright starting} ${this.imageName ?? "shell"} ({yellow ${this.stage}})\n`);
        }

        if (this.imageName) {
            const buildVolumeName = this.buildVolumeName;
            const tmpVolumeName = this.tmpVolumeName;
            const fileVariablesDir = this.fileVariablesDir;

            const volumePromises = [];
            volumePromises.push(Utils.spawn(["docker", "volume", "create", `${buildVolumeName}`], argv.cwd));
            volumePromises.push(Utils.spawn(["docker", "volume", "create", `${tmpVolumeName}`], argv.cwd));
            this._containerVolumeNames.push(buildVolumeName);
            this._containerVolumeNames.push(tmpVolumeName);
            await Promise.all(volumePromises);

            const time = process.hrtime();
            this.refreshLongRunningSilentTimeout(writeStreams);
            const {stdout: containerId} = await Utils.spawn([
                "docker", "create", `--volume=${buildVolumeName}:/gcl-builds`, `--volume=${tmpVolumeName}:${this.fileVariablesDir}`, "docker.io/firecow/gitlab-ci-local-util",
                "bash", "-c", "chown 0:0 -R /gcl-builds/ && chmod a+rw -R /gcl-builds/ && chmod a+rw -R /tmp/",
            ], argv.cwd);
            this._containersToClean.push(containerId);
            if (await fs.pathExists(fileVariablesDir)) {
                await Utils.spawn(["docker", "cp", `${fileVariablesDir}/.`, `${containerId}:${fileVariablesDir}`], argv.cwd);
                this.refreshLongRunningSilentTimeout(writeStreams);
            }
            await Utils.spawn(["docker", "cp", `${argv.stateDir}/builds/.docker/.`, `${containerId}:/gcl-builds`], argv.cwd);
            await Utils.spawn(["docker", "start", "--attach", containerId], argv.cwd);
            await Utils.spawn(["docker", "rm", "-f", containerId], argv.cwd);
            const endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright copied to docker volumes} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        if (this.services?.length) {
            await this.createDockerNetwork(`gitlab-ci-local-${this.jobId}`);
            for (const [serviceIndex, service] of this.services.entries()) {
                const serviceName = service.name;
                await this.pullImage(writeStreams, serviceName);
                const serviceContainerId = await this.startService(writeStreams, Utils.expandVariables({...expanded, ...service.variables}), service, serviceIndex);
                const serviceContanerLogFile = `${argv.cwd}/${argv.stateDir}/services-output/${this.safeJobName}/${serviceName}-${serviceIndex}.log`;
                await this.serviceHealthCheck(writeStreams, service, serviceContanerLogFile);
                const {stdout, stderr} = await Utils.spawn(["docker", "logs", serviceContainerId]);
                await fs.ensureFile(serviceContanerLogFile);
                await fs.promises.writeFile(serviceContanerLogFile, `### stdout ###\n${stdout}\n### stderr ###\n${stderr}\n`);
            }
        }

        const prescripts = this.beforeScripts.concat(this.scripts);
        expanded["CI_JOB_STATUS"] = "running";
        this._prescriptsExitCode = await this.execScripts(prescripts, expanded);
        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && !this.allowFailure) {
            this.registerEndTime();
            writeStreams.stderr(`${this.getExitedString(this._prescriptsExitCode, false)}\n`);
            this._running = false;
            await this.cleanupResources();
            return;
        }

        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && this.allowFailure) {
            this.registerEndTime();
            writeStreams.stderr(`${this.getExitedString(this._prescriptsExitCode, true)}\n`);
            this._running = false;
            await this.cleanupResources();
            return;
        }

        if (this._prescriptsExitCode > 0 && this.allowFailure) {
            this.registerEndTime();
            writeStreams.stderr(`${this.getExitedString(this._prescriptsExitCode, true)}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            this.registerEndTime();
            writeStreams.stderr(`${this.getExitedString(this._prescriptsExitCode, false)}\n`);
        }

        if (this.afterScripts.length > 0) {
            expanded["CI_JOB_STATUS"] = this._prescriptsExitCode === 0 ? "success" : "failed";
            this._afterScriptsExitCode = await this.execScripts(this.afterScripts, expanded);
        }

        if (this._afterScriptsExitCode > 0) {
            this.registerEndTime();
            writeStreams.stderr(`${this.getExitedString(this._afterScriptsExitCode, true, " after_script")}\n`);
        }

        this.registerEndTime();
        writeStreams.stdout(`${this.getFinishedString()}\n`);

        if (this.jobData["coverage"]) {
            this._coveragePercent = await Utils.getCoveragePercent(argv.cwd, argv.stateDir, this.jobData["coverage"], safeJobName);
        }

        this._running = false;
        await this.cleanupResources();
    }

    async cleanupResources () {
        clearTimeout(this._longRunningSilentTimeout);

        if (!this.argv.cleanup) return;

        for (const id of this._containersToClean) {
            try {
                await Utils.spawn(["docker", "rm", "-f", `${id}`]);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
            }
        }

        if (this._serviceNetworkId) {
            try {
                await Utils.spawn(["docker", "network", "rm", `${this._serviceNetworkId}`]);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
            }
        }

        if (this._containerVolumeNames.length > 0) {
            try {
                for (const containerVolume of this._containerVolumeNames) {
                    await Utils.spawn(["docker", "volume", "rm", `${containerVolume}`]);
                }
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
            }
        }

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
            // Print command echo'ed in color
            const split = script.split(/\r?\n/);
            const multilineText = split.length > 1 ? " # collapsed multi-line command" : "";
            const text = split[0]?.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[$]/g, "\\$");
            cmd += chalk`echo "{green $ ${text}${multilineText}}"\n`;

            // Execute actual script
            cmd += `${script}\n`;
        });
        return cmd;
    }

    private async mountCacheCmd (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        if (this.imageName && !this.argv.mountCache) return [];

        const cmd: string[] = [];
        for (const c of this.cache) {
            const uniqueCacheName = await this.getUniqueCacheName(this.argv.cwd, expanded, c.key);
            c.paths.forEach((p) => {
                const path = Utils.expandText(p, expanded);
                writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright mounting cache} for path ${path}\n`);
                const cacheMount = Utils.safeDockerString(`gcl-${expanded.CI_PROJECT_PATH_SLUG}-${uniqueCacheName}`);
                cmd.push("-v", `${cacheMount}:/gcl-builds/${path}`);
            });
        }
        return cmd;
    }

    private async execScripts (scripts: string[], expanded: {[key: string]: string}): Promise<number> {
        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const safeJobName = this.safeJobName;
        const outputFilesPath = `${cwd}/${stateDir}/output/${safeJobName}.log`;
        const buildVolumeName = this.buildVolumeName;
        const tmpVolumeName = this.tmpVolumeName;
        const writeStreams = this.writeStreams;

        if (scripts.length === 0 || scripts[0] == null) {
            return 0;
        }

        // Copy git tracked files to build folder if shell isolation enabled.
        if (!this.imageName && this.argv.shellIsolation) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, `${safeJobName}`);
        }

        if (this.interactive) {
            const iCmd = this.generateScriptCommands(scripts);
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

        if (this.imageName) {
            await this.pullImage(writeStreams, this.imageName);

            let dockerCmd = `docker create --interactive ${this.generateInjectSSHAgentOptions()} `;
            if (this.argv.privileged) {
                dockerCmd += "--privileged ";
            }

            if (this.argv.ulimit > 0) {
                dockerCmd += `--ulimit nofile=${this.argv.ulimit} `;
            }

            if (this.argv.umask) {
                dockerCmd += "--user 0:0 ";
            }

            if (this.services?.length) {
                dockerCmd += `--network gitlab-ci-local-${this.jobId} `;
            }

            dockerCmd += `--volume ${buildVolumeName}:/gcl-builds `;
            dockerCmd += `--volume ${tmpVolumeName}:${this.fileVariablesDir} `;
            dockerCmd += "--workdir /gcl-builds ";

            for (const volume of this.argv.volume) {
                dockerCmd += `--volume ${volume} `;
            }

            for (const extraHost of this.argv.extraHost) {
                dockerCmd += `--add-host=${extraHost} `;
            }

            const entrypointFile = `${cwd}/${stateDir}/scripts/image_entry/${safeJobName}`;
            if (this.imageEntrypoint) {
                if (this.imageEntrypoint[0] == "") {
                    dockerCmd += "--entrypoint '' ";
                } else {
                    await fs.outputFile(entrypointFile, "#!/bin/sh\n");
                    await fs.appendFile(entrypointFile, `${this.imageEntrypoint.join(" ")}`);
                    await fs.chmod(entrypointFile, "0755");
                    dockerCmd += "--entrypoint '/gcl-entry' ";
                    await fs.appendFile(entrypointFile, " \"$@\"\n");
                }
            }

            for (const key of Object.keys(expanded)) {
                dockerCmd += `-e ${key} `;
            }

            dockerCmd += `${(await this.mountCacheCmd(writeStreams, expanded)).join(" ")} `;
            dockerCmd += `${this.imageName} sh -c "\n`;
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

            const {stdout: containerId} = await Utils.bash(dockerCmd, cwd, expanded);
            this._containerId = containerId;
            this._containersToClean.push(this._containerId);
        }

        await this.copyCacheIn(writeStreams, expanded);
        await this.copyArtifactsIn(writeStreams);

        let cmd = "set -eo pipefail\n";
        cmd += "exec 0< /dev/null\n";

        if (!this.imageName && this.argv.shellIsolation) {
            cmd += `cd ${stateDir}/builds/${safeJobName}/\n`;
        }
        cmd += this.generateScriptCommands(scripts);

        cmd += "exit 0\n";

        await fs.outputFile(`${cwd}/${stateDir}/scripts/${safeJobName}`, cmd, "utf-8");
        await fs.chmod(`${cwd}/${stateDir}/scripts/${safeJobName}`, "0755");

        if (this.imageName) {
            await Utils.spawn(["docker", "cp", `${stateDir}/scripts/${safeJobName}`, `${this._containerId}:/gcl-cmd`], cwd);
        }
        if (this.imageEntrypoint && this.imageEntrypoint[0] != "") {
            await Utils.spawn(["docker", "cp", `${stateDir}/scripts/image_entry/${safeJobName}`, `${this._containerId}:/gcl-entry`], cwd);
        }

        const cp = execa(this._containerId ? `docker start --attach -i ${this._containerId}` : "bash", {
            cwd,
            shell: "bash",
            env: expanded,
        });

        const outFunc = (line: string, stream: (txt: string) => void, colorize: (str: string) => string) => {
            this.refreshLongRunningSilentTimeout(writeStreams);
            stream(`${this.formattedJobName} `);
            if (!line.startsWith("\u001b[32m$")) {
                stream(`${colorize(">")} `);
            }
            stream(`${line}\n`);
            fs.appendFileSync(outputFilesPath, `${line}\n`);
        };

        const quiet = this.argv.quiet;
        const exitCode = await new Promise<number>((resolve, reject) => {
            if (!quiet) {
                cp.stdout?.pipe(split2()).on("data", (e: string) => outFunc(e, writeStreams.stdout.bind(writeStreams), (s) => chalk`{greenBright ${s}}`));
                cp.stderr?.pipe(split2()).on("data", (e: string) => outFunc(e, writeStreams.stderr.bind(writeStreams), (s) => chalk`{redBright ${s}}`));
            }
            void cp.on("exit", (code) => resolve(code ?? 0));
            void cp.on("error", (err) => reject(err));

            if (this.imageName) {
                cp.stdin?.end("/gcl-cmd");
            } else {
                cp.stdin?.end(`./${stateDir}/scripts/${safeJobName}`);
            }
        });

        await this.copyCacheOut(writeStreams, expanded, exitCode);

        if (exitCode == 0 || this.artifacts?.when === "always") {
            await this.copyArtifactsOut(writeStreams, expanded);
        }

        return exitCode;
    }

    private async pullImage (writeStreams: WriteStreams, imageToPull: string) {
        const time = process.hrtime();
        try {
            await Utils.spawn(["docker", "image", "inspect", imageToPull]);
        } catch (e: any) {
            if (e.stderr?.includes("No such image") || e.stderr?.includes("failed to find image")) {
                await Utils.spawn(["docker", "pull", imageToPull]);
                const endTime = process.hrtime(time);
                writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright pulled} ${imageToPull} in {magenta ${prettyHrtime(endTime)}}\n`);
            } else {
                throw e;
            }
            this.refreshLongRunningSilentTimeout(writeStreams);
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
        if (this.argv.mountCache && this.imageName) return;
        if ((!this.imageName && !this.argv.shellIsolation) || this.cache.length === 0) return;

        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;

        for (const c of this.cache) {
            if (!["pull", "pull-push"].includes(c.policy)) return;

            const time = process.hrtime();
            const cacheName = await this.getUniqueCacheName(cwd, expanded, c.key);
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
        if ((!this.imageName && !this.argv.shellIsolation) || (this.producers ?? []).length === 0) return;

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
        if (!this.imageName && this.argv.shellIsolation) {
            return Utils.spawn(["rsync", "-a", `${source}/.`, `${this.argv.cwd}/${this.argv.stateDir}/builds/${safeJobName}`]);
        }
        return Utils.spawn(["docker", "cp", `${source}/.`, `${this._containerId}:/gcl-builds`]);
    }

    private async copyCacheOut (writeStreams: WriteStreams, expanded: {[key: string]: string}, exitCode: number) {
        if (this.argv.mountCache && this.imageName) return;
        if ((!this.imageName && !this.argv.shellIsolation) || this.cache.length === 0) return;

        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;

        let time, endTime;
        for (const c of this.cache) {
            if (!["push", "pull-push"].includes(c.policy)) return;
            if ("on_success" === c.when && exitCode != 0) return;
            if ("on_failure" === c.when && exitCode === 0) return;
            const cacheName = await this.getUniqueCacheName(cwd, expanded, c.key);
            for (const path of c.paths) {
                time = process.hrtime();
                const expandedPath = Utils.expandText(path, expanded).replace(`${expanded.CI_PROJECT_DIR}/`, "");
                let cmd = "shopt -s globstar nullglob dotglob\n";
                cmd += `mkdir -p ../../cache/${cacheName}\n`;
                cmd += `rsync -Ra ${expandedPath} ../../cache/${cacheName}/. || true\n`;

                await Mutex.exclusive(cacheName, async () => {
                    await this.copyOut(cmd, stateDir, "cache", []);
                });
                endTime = process.hrtime(time);

                const readdir = await fs.readdir(`${this.argv.cwd}/${stateDir}/cache/${cacheName}`);
                if (readdir.length === 0) {
                    writeStreams.stdout(chalk`${this.formattedJobName} {yellow !! no cache was copied for ${path} !!}\n`);
                } else {
                    writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright exported cache ${expandedPath} '${cacheName}'} in {magenta ${prettyHrtime(endTime)}}\n`);
                }
            }
        }
    }

    private async copyArtifactsOut (writeStreams: WriteStreams, expanded: {[key: string]: string}) {
        const safeJobName = this.safeJobName;
        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const artifactsPath = !this.argv.shellIsolation && !this.imageName ? `${stateDir}/artifacts` : "../../artifacts";

        if (!this.artifacts) return;
        if ((this.artifacts.paths?.length ?? 0) === 0 && this.artifacts.reports?.dotenv == null) return;

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
        if (reportDotenv != null) {
            cpCmd += `mkdir -p ${artifactsPath}/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
            cpCmd += `if [ -f ${reportDotenv} ]; then\n`;
            cpCmd += `  rsync -Ra ${reportDotenv} ${artifactsPath}/${safeJobName}/.gitlab-ci-reports/dotenv/.\n`;
            cpCmd += "fi\n";
        }

        time = process.hrtime();
        const dockerCmdExtras = this.argv.mountCache ? await this.mountCacheCmd(writeStreams, expanded) : [];
        await this.copyOut(cpCmd, stateDir, "artifacts", dockerCmdExtras);
        endTime = process.hrtime(time);

        if (reportDotenv != null && !await fs.pathExists(`${cwd}/${stateDir}/artifacts/${safeJobName}/.gitlab-ci-reports/dotenv/${reportDotenv}`)) {
            writeStreams.stderr(chalk`${this.formattedJobName} {yellow artifact reports dotenv '${reportDotenv}' could not be found}\n`);
        }

        const readdir = await fs.readdir(`${cwd}/${stateDir}/artifacts/${safeJobName}`);
        if (readdir.length === 0) {
            writeStreams.stdout(chalk`${this.formattedJobName} {yellow !! no artifacts was copied !!}\n`);
        } else {
            writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright exported artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        if (this.artifactsToSource && (this.argv.shellIsolation || this.imageName)) {
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

        await fs.mkdirp(`${cwd}/${stateDir}/${type}`);

        if (this.imageName) {
            const {stdout: containerId} = await Utils.bash(`docker create -i ${dockerCmdExtras.join(" ")} -v ${buildVolumeName}:/gcl-builds/ -w /gcl-builds docker.io/firecow/gitlab-ci-local-util bash -c "${cmd}"`, cwd);
            this._containersToClean.push(containerId);
            await Utils.spawn(["docker", "start", containerId, "--attach"]);
            await Utils.spawn(["docker", "cp", `${containerId}:/${type}/.`, `${stateDir}/${type}/.`], cwd);
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

    private getExitedString (code: number, warning = false, prependString = "") {
        const finishedStr = this.getFinishedString();
        if (warning) {
            return chalk`${finishedStr} {black.bgYellowBright  WARN ${code.toString()} }${prependString}`;
        }

        return chalk`${finishedStr} {black.bgRed  FAIL ${code.toString()} } ${prependString}`;
    }

    private registerEndTime () {
        this._endTime = this._endTime ?? process.hrtime(this._startTime);
    }

    private getFinishedString () {
        this._endTime = this._endTime ?? process.hrtime(this._startTime);
        return chalk`${this.formattedJobName} {magentaBright finished} in {magenta ${this.prettyDuration}}`;
    }

    private async createDockerNetwork (networkName: string) {
        const {stdout: networkId} = await Utils.spawn(["docker", "network", "create", `${networkName}`]);
        this._serviceNetworkId = networkId;
    }

    private async startService (writeStreams: WriteStreams, expanded: {[key: string]: string}, service: Service, serviceIndex: number) {
        const cwd = this.argv.cwd;
        const stateDir = this.argv.stateDir;
        const safeJobName = this.safeJobName;
        let dockerCmd = `docker create --interactive --network gitlab-ci-local-${this.jobId} `;
        this.refreshLongRunningSilentTimeout(writeStreams);

        if (this.argv.umask) {
            dockerCmd += "--user 0:0 ";
        }

        if (this.argv.privileged) {
            dockerCmd += "--privileged ";
        }

        if (this.argv.ulimit > 0) {
            dockerCmd += `--ulimit nofile=${this.argv.ulimit} `;
        }

        for (const volume of this.argv.volume) {
            dockerCmd += `--volume ${volume} `;
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

        for (const alias of aliases) {
            dockerCmd += `--network-alias=${alias} `;
        }

        for (const key of Object.keys(expanded)) {
            dockerCmd += `-e ${key} `;
        }

        const serviceEntrypoint = service.entrypoint;
        const serviceEntrypointFile = `${cwd}/${stateDir}/scripts/services_entry/${safeJobName}_${serviceNameWithoutVersion}_${serviceIndex}`;
        if (serviceEntrypoint) {
            if (serviceEntrypoint[0] == "") {
                dockerCmd += "--entrypoint '' ";
            } else {
                await fs.outputFile(serviceEntrypointFile, "#!/bin/sh\n");
                await fs.appendFile(serviceEntrypointFile, `${serviceEntrypoint.join(" ")}`);
                await fs.appendFile(serviceEntrypointFile, " \"$@\"\n");
                await fs.chmod(serviceEntrypointFile, "0755");
                dockerCmd += "--entrypoint '/gcl-entry' ";
            }
        }
        dockerCmd += `--volume ${this.buildVolumeName}:/gcl-builds `;
        dockerCmd += `--volume ${this.tmpVolumeName}:${this.fileVariablesDir} `;
        dockerCmd += `${serviceName} `;

        (service.command ?? []).forEach((e) => dockerCmd += `"${e}" `);

        const time = process.hrtime();

        const {stdout: containerId} = await Utils.bash(dockerCmd, cwd, expanded);
        this._containersToClean.push(containerId);

        // Copy docker entrypoint if specified for service
        if (serviceEntrypoint && serviceEntrypoint[0] != "") {
            await Utils.spawn(["docker", "cp", serviceEntrypointFile, `${containerId}:/gcl-entry`]);
        }

        await Utils.spawn(["docker", "start", `${containerId}`]);

        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.formattedJobName} {magentaBright started service image: ${serviceName} with aliases: ${Array.from(aliases).join(", ")}} in {magenta ${prettyHrtime(endTime)}}\n`);

        return containerId;
    }

    private async serviceHealthCheck (writeStreams: WriteStreams, service: Service, serviceContanerLogFile: string) {
        const serviceAlias = service.alias;
        const serviceName = service.name;

        const {stdout} = await Utils.spawn(["docker", "image", "inspect", serviceName]);
        const imageInspect = JSON.parse(stdout);

        // Copied from the startService block. Important thing is that the aliases match
        const serviceNameWithoutVersion = serviceName.replace(/(.*)(:.*)/, "$1");
        const aliases = [serviceNameWithoutVersion.replaceAll("/", "-"), serviceNameWithoutVersion.replaceAll("/", "__")];
        if (serviceAlias) {
            aliases.push(serviceAlias);
        }

        if ((imageInspect[0]?.Config?.ExposedPorts ?? null) === null) {
            return writeStreams.stderr(chalk`${this.formattedJobName} {yellow Could not find exposed tcp ports ${serviceName}}\n`);
        }

        const time = process.hrtime();
        try {
            // Iterate over each port defined in the image, and try to connect to the alias
            await Promise.any(Object.keys(imageInspect[0].Config.ExposedPorts).map((port) => {
                if (!port.endsWith("/tcp")) return;
                const portNum = parseInt(port.replace("/tcp", ""));
                const spawnCmd = ["docker", "run", "--rm", `--name=gcl-wait-for-it-${this.jobId}-${portNum}`, "--network", `gitlab-ci-local-${this.jobId}`, "willwill/wait-for-it", `${aliases[0]}:${portNum}`, "-t", "30"];
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
                writeStreams.stdout(chalk`${this.formattedJobName} {redBright also see (${serviceContanerLogFile})}\n`);
            });
        } finally {
            // Kill all wait-for-it containers, when one have been successful
            await Promise.all(Object.keys(imageInspect[0].Config.ExposedPorts).map((port) => {
                if (!port.endsWith("/tcp")) return;
                const portNum = parseInt(port.replace("/tcp", ""));
                return Utils.spawn(["docker", "rm", "-f", `gcl-wait-for-it-${this.jobId}-${portNum}`]);
            }));
        }
    }
}
