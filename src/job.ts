import chalk from "chalk";
import * as dotenv from "dotenv";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import prettyHrtime from "pretty-hrtime";
import camelCase from "camelcase";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";
import {JobOptions} from "./types/job-options";
import {WriteStreams} from "./types/write-streams";
import {Service} from "./service";
import {GitData} from "./git-data";
import {assert} from "./asserts";
import {CacheEntry} from "./cache-entry";
import {Mutex} from "async-mutex";

export class Job {

    static readonly illegalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "workflow",
    ];

    readonly name: string;
    readonly jobNamePad: number;
    readonly dependencies: string[] | null;
    readonly environment?: { name: string; url: string | null };
    readonly jobId: number;
    readonly cwd: string;
    readonly rules?: { if: string; when: string; allow_failure: boolean }[];
    readonly expandedVariables: { [key: string]: string };
    readonly allowFailure: boolean;
    readonly when: string;
    readonly pipelineIid: number;
    readonly gitData: GitData;
    readonly shellIsolation: boolean;
    readonly cacheMutexMap = new Map<string, Mutex>();
    readonly mountCache: boolean;

    private _prescriptsExitCode: number | null = null;
    private _afterScriptsExitCode = 0;
    private _coveragePercent: string | null = null;
    private _running = false;
    private _containerId: string | null = null;
    private _serviceNetworkId: string | null = null;
    private _containerVolumeNames: string[] = [];
    private _longRunningSilentTimeout: NodeJS.Timeout = -1 as any;
    private _producers: { name: string; dotenv: string | null }[] | null = null;

    private _containersToClean: string[] = [];

    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;
    private readonly extraHosts: string[];
    private readonly volumes: string[];

    constructor(opt: JobOptions) {
        const jobData = opt.data;
        const gitData = opt.gitData;
        const globals = opt.globals;
        const homeVariables = opt.homeVariables;
        const projectVariables = opt.projectVariables;

        this.mountCache = opt.mountCache;
        this.extraHosts = opt.extraHosts;
        this.volumes = opt.volumes;
        this.writeStreams = opt.writeStreams;
        this.jobNamePad = opt.namePad;
        this.gitData = opt.gitData;
        this.name = opt.name;
        this.cwd = opt.cwd;
        this.jobId = Math.floor(Math.random() * 1000000);
        this.jobData = opt.data;
        this.pipelineIid = opt.pipelineIid;
        this.shellIsolation = opt.shellIsolation;

        this.when = jobData.when || "on_success";
        this.allowFailure = jobData.allow_failure ?? false;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;

        let CI_PROJECT_DIR = `${this.cwd}`;
        if (this.imageName) {
            CI_PROJECT_DIR = `/builds/${this.safeJobName}`;
        } else if (this.shellIsolation) {
            CI_PROJECT_DIR = `${this.cwd}/.gitlab-ci-local/builds/${this.safeJobName}`;
        }

        const predefinedVariables = {
            GITLAB_USER_LOGIN: gitData.user["GITLAB_USER_LOGIN"],
            GITLAB_USER_EMAIL: gitData.user["GITLAB_USER_EMAIL"],
            GITLAB_USER_NAME: gitData.user["GITLAB_USER_NAME"],
            GITLAB_USER_ID: gitData.user["GITLAB_USER_ID"],
            CI_COMMIT_SHORT_SHA: gitData.commit.SHORT_SHA, // Changes
            CI_COMMIT_SHA: gitData.commit.SHA,
            CI_PROJECT_DIR,
            CI_PROJECT_NAME: gitData.remote.project,
            CI_PROJECT_TITLE: `${camelCase(gitData.remote.project)}`,
            CI_PROJECT_PATH: gitData.CI_PROJECT_PATH,
            CI_PROJECT_PATH_SLUG: gitData.CI_PROJECT_PATH_SLUG,
            CI_PROJECT_NAMESPACE: `${gitData.remote.group}`,
            CI_PROJECT_VISIBILITY: "internal",
            CI_PROJECT_ID: "1217",
            CI_COMMIT_REF_PROTECTED: "false",
            CI_COMMIT_BRANCH: gitData.commit.REF_NAME, // Not available in merge request or tag pipelines
            CI_COMMIT_REF_NAME: gitData.commit.REF_NAME, // Tag or branch name
            CI_COMMIT_REF_SLUG: gitData.commit.REF_NAME.replace(/[^a-z0-9]+/ig, "-").replace(/^-/, "").replace(/-$/, "").slice(0, 63).toLowerCase(),
            CI_COMMIT_TITLE: "Commit Title", // First line of commit message.
            CI_COMMIT_MESSAGE: "Commit Title\nMore commit text", // Full commit message
            CI_COMMIT_DESCRIPTION: "More commit text",
            CI_PIPELINE_SOURCE: "push",
            CI_JOB_ID: `${this.jobId}`,
            CI_PIPELINE_ID: `${this.pipelineIid + 1000}`,
            CI_PIPELINE_IID: `${this.pipelineIid}`,
            CI_SERVER_HOST: `${gitData.remote.host}`,
            CI_SERVER_PORT: `${gitData.remote.port}`,
            CI_SERVER_URL: `https://${gitData.remote.host}:443`,
            CI_SERVER_PROTOCOL: "https",
            CI_API_V4_URL: `https://${gitData.remote.host}/api/v4`,
            CI_PROJECT_URL: `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}`,
            CI_JOB_URL: `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}/-/jobs/${this.jobId}`, // Changes on rerun.
            CI_PIPELINE_URL: `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}/pipelines/${this.pipelineIid}`,
            CI_JOB_NAME: `${this.name}`,
            CI_JOB_STAGE: `${this.stage}`,
            CI_REGISTRY: gitData.CI_REGISTRY,
            CI_REGISTRY_IMAGE: gitData.CI_REGISTRY_IMAGE,
            GITLAB_CI: "false",
        };

        // Create expanded variables
        const envs = {...predefinedVariables, ...globals.variables || {}, ...jobData.variables || {}, ...homeVariables, ...projectVariables};
        const expandedGlobalVariables = Utils.expandVariables(globals.variables || {}, envs);
        const expandedJobVariables = Utils.expandVariables(jobData.variables || {}, envs);
        this.expandedVariables = {...predefinedVariables, ...expandedGlobalVariables, ...expandedJobVariables, ...homeVariables, ...projectVariables};

        // Set {when, allowFailure} based on rules result
        if (this.rules) {
            const ruleResult = Utils.getRulesResult(this.rules, this.expandedVariables);
            this.when = ruleResult.when;
            this.allowFailure = ruleResult.allowFailure;
        }

        if (this.interactive && (this.when !== "manual" || this.imageName !== null)) {
            throw new ExitError(`${this.chalkJobName} @Interactive decorator cannot have image: and must be when:manual`);
        }

        if (this.injectSSHAgent && this.imageName === null) {
            throw new ExitError(`${this.chalkJobName} @InjectSSHAgent can only be used with image:`);
        }

        if (this.imageName && this.mountCache) {
            for (const c of this.cache) {
                c.paths.forEach((p) => {
                    const path = Utils.expandText(p, this.expandedVariables);
                    if (path.includes("*")) {
                        throw new ExitError(`${this.name} cannot have * in cache paths, when --mount-cache is enabled`);
                    }
                });
            }
        }
    }

    get artifactsToSource() {
        return this.jobData["artifactsToSource"] == null ? true : this.jobData["artifactsToSource"];
    }

    get chalkJobName() {
        return chalk`{blueBright ${this.name.padEnd(this.jobNamePad)}}`;
    }

    get safeJobName() {
        return Utils.getSafeJobName(this.name);
    }

    get needs(): {job: string; artifacts: boolean}[] | null {
        const needs = this.jobData["needs"];
        if (!needs) return null;
        const list: {job: string; artifacts: boolean}[] = [];
        needs.forEach((need: any) => {
            list.push({
                job: typeof need === "string" ? need : need.job,
                artifacts: typeof need === "string" ? true : need.artifacts,
            });
        });
        return list;
    }

    get cache(): CacheEntry[] {
        let cacheData = this.jobData["cache"];
        const cacheList: CacheEntry[] = [];
        if (!cacheData) return [];

        cacheData = Array.isArray(cacheData) ? cacheData : [cacheData];
        cacheData.forEach((c: any) => {
            const key = c["key"];
            const policy = c["policy"] ?? "pull-push";
            if (!["pull", "push", "pull-push"].includes(policy)) {
                throw new ExitError("cache policy is not 'pull', 'push' or 'pull-push'");
            }
            const paths = c["paths"] ?? [];
            cacheList.push(new CacheEntry(key, paths, policy));
        });
        return cacheList;
    }

    get buildVolumeName(): string {
        return `gcl-${this.safeJobName}-${this.jobId}-build`;
    }

    get tmpVolumeName(): string {
        return `gcl-${this.safeJobName}-${this.jobId}-tmp`;
    }

    get imageName(): string | null {
        const image = this.jobData["image"];
        if (!image) {
            return null;
        }

        const imageName = Utils.expandText(image.name, this.expandedVariables);
        return imageName.includes(":") ? imageName : `${imageName}:latest`;
    }

    get imageEntrypoint(): string[] | null {
        const image = this.jobData["image"];

        if (!image || !image.entrypoint) {
            return null;
        }
        if (typeof image.entrypoint !== "object") {
            throw new ExitError("image:entrypoint must be an array");
        }
        return image.entrypoint;
    }

    get services(): Service[] {
        return this.jobData["services"];
    }

    get producers(): { name: string; dotenv: string | null }[] | null {
        return this._producers;
    }

    set producers(producers: { name: string; dotenv: string | null }[] | null) {
        assert(this._producers == null, "this._producers can only be set once");
        this._producers = producers;
    }

    get stage(): string {
        return this.jobData["stage"] || "test";
    }

    get interactive(): boolean {
        return this.jobData["interactive"] || false;
    }

    get injectSSHAgent(): boolean {
        return this.jobData["injectSSHAgent"] || false;
    }

    get description(): string {
        return this.jobData["description"] ?? "";
    }

    get artifacts(): { paths?: string[]; exclude?: string[]; reports?: { dotenv?: string } }|null {
        return this.jobData["artifacts"];
    }

    get beforeScripts(): string[] {
        return this.jobData["before_script"] || [];
    }

    get afterScripts(): string[] {
        return this.jobData["after_script"] || [];
    }

    get scripts(): string[] {
        return this.jobData["script"];
    }

    get preScriptsExitCode() {
        return this._prescriptsExitCode;
    }

    get afterScriptsExitCode() {
        return this._afterScriptsExitCode;
    }

    get running() {
        return this._running;
    }

    get started() {
        return this._running || this._prescriptsExitCode !== null;
    }

    get finished() {
        return !this._running && this._prescriptsExitCode !== null;
    }

    get coveragePercent(): string | null {
        return this._coveragePercent;
    }

    async start(privileged: boolean): Promise<void> {
        const startTime = process.hrtime();
        const writeStreams = this.writeStreams;
        const safeJobname = this.safeJobName;

        this._running = true;

        await fs.ensureFile(`${this.cwd}/.gitlab-ci-local/output/${safeJobname}.log`);
        await fs.truncate(`${this.cwd}/.gitlab-ci-local/output/${safeJobname}.log`);

        if (!this.interactive) {
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright starting} ${this.imageName ?? "shell"} ({yellow ${this.stage}})\n`);
        }

        const prescripts = this.beforeScripts.concat(this.scripts);
        this._prescriptsExitCode = await this.execScripts(prescripts, privileged);
        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && !this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
            await this.cleanupResources();
            this._running = false;
            return;
        }

        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
            await this.cleanupResources();
            this._running = false;
            return;
        }

        if (this._prescriptsExitCode > 0 && this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
        }

        if (this.afterScripts.length > 0) {
            this._afterScriptsExitCode = await this.execScripts(this.afterScripts, privileged);
        }

        if (this._afterScriptsExitCode > 0) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._afterScriptsExitCode, true, " after_script")}\n`);
        }

        writeStreams.stdout(`${this.getFinishedString(startTime)}\n`);

        if (this.jobData.coverage) {
            this._coveragePercent = await Utils.getCoveragePercent(this.cwd, this.jobData.coverage, safeJobname);
        }

        await this.cleanupResources();
        this._running = false;
    }

    async cleanupResources() {
        const writeStreams = this.writeStreams;
        clearTimeout(this._longRunningSilentTimeout);

        for (const id of this._containersToClean) {
            try {
                await Utils.spawn(`docker rm -f ${id}`);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._serviceNetworkId) {
            try {
                await Utils.spawn(`docker network rm ${this._serviceNetworkId}`);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._containerVolumeNames.length > 0) {
            try {
                for (const containerVolume of this._containerVolumeNames) {
                    await Utils.spawn(`docker volume rm ${containerVolume}`);
                }
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }
    }

    private generateInjectSSHAgentOptions() {
        if (!this.injectSSHAgent) {
            return "";
        }
        if (process.platform === "darwin" || (process.env.OSTYPE?.match(/^darwin/) ?? null)) {
            return "--env SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock -v /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock";
        }
        return `--env SSH_AUTH_SOCK=${process.env.SSH_AUTH_SOCK} -v ${process.env.SSH_AUTH_SOCK}:${process.env.SSH_AUTH_SOCK}`;
    }

    private generateScriptCommands(scripts: string[]) {
        let cmd = "";
        scripts.forEach((script) => {
            // Print command echo'ed in color
            const split = script.split(/\r?\n/);
            const multilineText = split.length > 1 ? " # collapsed multi-line command" : "";
            const text = split[0]?.replace(/[\\]/g, "\\\\").replace(/["]/g, "\\\"").replace(/[$]/g, "\\$");
            cmd += chalk`echo "{green $ ${text}${multilineText}}"\n`;

            // Execute actual script
            cmd += `${script}\n`;
        });
        return cmd;
    }

    private async mountCacheCmd(safeJobName: string, writeStreams: WriteStreams) {
        if (this.imageName && !this.mountCache) return "";

        let cmd = "";
        for (const c of this.cache) {
            const uniqueCacheName = await c.getUniqueCacheName(this.cwd, this.expandedVariables);
            c.paths.forEach((p) => {
                const path = Utils.expandText(p, this.expandedVariables);
                writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright mounting cache} for path ${path}\n`);
                const cacheMount = `gcl-${this.expandedVariables.CI_PROJECT_PATH_SLUG}-${uniqueCacheName}`;
                cmd += `-v ${cacheMount}:/builds/${safeJobName}/${path} `;
            });
        }
        return cmd;
    }

    private async execScripts(scripts: string[], privileged: boolean): Promise<number> {
        const safeJobName = this.safeJobName;
        const outputFilesPath = `${this.cwd}/.gitlab-ci-local/output/${safeJobName}.log`;
        const buildVolumeName = this.buildVolumeName;
        const tmpVolumeName = this.tmpVolumeName;
        const writeStreams = this.writeStreams;
        const reportsDotenvVariables = await this.initProducerReportsDotenvVariables(writeStreams);
        let time;
        let endTime;

        if (scripts.length === 0 || scripts[0] == null) {
            return 0;
        }

        // Copy git tracked files to build folder if shell isolation enabled.
        if (!this.imageName && this.shellIsolation) {
            await Utils.rsyncTrackedFiles(this.cwd, `${safeJobName}`);
        }

        if (this.interactive) {
            const iCmd = this.generateScriptCommands(scripts);
            const interactiveCp = childProcess.spawn(iCmd, {
                shell: "bash",
                stdio: ["inherit", "inherit", "inherit"],
                cwd: this.cwd,
                env: {...this.expandedVariables, ...process.env},
            });
            return new Promise<number>((resolve, reject) => {
                interactiveCp.on("exit", (code) => resolve(code ?? 0));
                interactiveCp.on("error", (err) => reject(err));
            });
        }

        this.refreshLongRunningSilentTimeout(writeStreams);

        if (this.imageName) {
            await this.pullImage(writeStreams, this.imageName);

            let dockerCmd = "";
            if (privileged) {
                dockerCmd += `docker create --privileged -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            } else {
                dockerCmd += `docker create -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            }
            if (this.services?.length) {
                await this.createDockerNetwork(`gitlab-ci-local-${this.jobId}`);
                dockerCmd += `--network gitlab-ci-local-${this.jobId} `;
                for (const service of this.services) {
                    await this.pullImage(writeStreams, service.getName(this.expandedVariables));
                    await this.startService(writeStreams, service, privileged);
                }
            }

            const volumePromises = [];
            volumePromises.push(Utils.spawn(`docker volume create ${buildVolumeName}`, this.cwd));
            volumePromises.push(Utils.spawn(`docker volume create ${tmpVolumeName}`, this.cwd));
            dockerCmd += `--volume ${buildVolumeName}:/builds/${safeJobName} `;
            dockerCmd += `--volume ${tmpVolumeName}:/tmp/ `;
            this._containerVolumeNames.push(buildVolumeName);
            this._containerVolumeNames.push(tmpVolumeName);
            await Promise.all(volumePromises);

            dockerCmd += `--workdir /builds/${safeJobName} `;

            for (const volume of this.volumes) {
                dockerCmd += `--volume ${volume} `;
            }

            for (const extraHost of this.extraHosts) {
                dockerCmd += `--add-host=${extraHost} `;
            }

            if (this.imageEntrypoint) {
                this.imageEntrypoint.forEach((e) => {
                    dockerCmd += `--entrypoint "${e}" `;
                });
            }

            for (const [key, value] of Object.entries(this.expandedVariables)) {
                dockerCmd += `-e ${key}='${String(value).trim()}' `;
            }
            for (const [key, value] of Object.entries(reportsDotenvVariables)) {
                dockerCmd += `-e ${key}='${String(value).trim()}' `;
            }

            dockerCmd += await this.mountCacheCmd(safeJobName, writeStreams);

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

            const {stdout: containerId} = await Utils.spawn(dockerCmd, this.cwd);
            this._containerId = containerId.replace(/\r?\n/g, "");
            this._containersToClean.push(this._containerId);

            time = process.hrtime();
            // Copy source files into container.
            await Utils.spawn(`docker cp .gitlab-ci-local/builds/.docker/. ${this._containerId}:/builds/${safeJobName}`, this.cwd);
            this.refreshLongRunningSilentTimeout(writeStreams);

            // Copy file variables into container.
            const fileVariablesFolder = `/tmp/gitlab-ci-local-file-variables-${this.gitData.CI_PROJECT_PATH_SLUG}/`;
            if (await fs.pathExists(fileVariablesFolder)) {
                await Utils.spawn(`docker cp ${fileVariablesFolder} ${this._containerId}:${fileVariablesFolder}/`, this.cwd);
                this.refreshLongRunningSilentTimeout(writeStreams);
            }

            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied to container} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        await this.copyCacheIn(writeStreams);
        await this.copyArtifactsIn(writeStreams);

        if (this.imageName) {
            // Files in docker-executor build folder must be root owned.
            await Utils.spawn(`docker run --rm -w /app/ -v ${buildVolumeName}:/app/ firecow/gitlab-ci-local-util bash -c "chown 0:0 -R . && chmod a+rw -R ."`);
        }

        let cmd = "set -eo pipefail\n";
        cmd += "exec 0< /dev/null\n";

        if (!this.imageName && this.shellIsolation) {
            cmd += `cd .gitlab-ci-local/builds/${safeJobName}/\n`;
        }
        cmd += this.generateScriptCommands(scripts);

        cmd += "exit 0\n";

        await fs.outputFile(`${this.cwd}/.gitlab-ci-local/scripts/${safeJobName}`, cmd, "utf-8");
        await fs.chmod(`${this.cwd}/.gitlab-ci-local/scripts/${safeJobName}`, "0755");

        if (this.imageName) {
            await Utils.spawn(`docker cp .gitlab-ci-local/scripts/. ${this._containerId}:/gcl-scripts/`, this.cwd);
        }

        const cp = childProcess.spawn(this._containerId ? `docker start --attach -i ${this._containerId}` : "bash", {
            shell: "bash",
            stdio: ["pipe", "pipe", "pipe"],
            cwd: this.cwd,
            env: this.imageName ? {...process.env} : {...this.expandedVariables, ...reportsDotenvVariables, ...process.env},
        });

        const outFunc = (e: any, stream: (txt: string) => void, colorize: (str: string) => string) => {
            this.refreshLongRunningSilentTimeout(writeStreams);
            for (const line of `${e}`.split(/\r?\n/)) {
                if (line.length === 0) {
                    continue;
                }

                stream(`${this.chalkJobName} `);
                if (!line.startsWith("\u001b[32m$")) {
                    stream(`${colorize(">")} `);
                }
                stream(`${line}\n`);
                fs.appendFileSync(outputFilesPath, `${line}\n`);
            }
        };

        const exitCode = await new Promise<number>((resolve, reject) => {
            cp.stdout.on("data", (e) => outFunc(e, writeStreams.stdout.bind(writeStreams), (s) => chalk`{greenBright ${s}}`));
            cp.stderr.on("data", (e) => outFunc(e, writeStreams.stderr.bind(writeStreams), (s) => chalk`{redBright ${s}}`));

            cp.on("exit", (code) => setTimeout(() => resolve(code ?? 0), 10));
            cp.on("error", (err) => setTimeout(() => reject(err), 10));

            if (this.imageName) {
                cp.stdin.end(`/gcl-scripts/${safeJobName}`);
            } else {
                cp.stdin.end(`./.gitlab-ci-local/scripts/${safeJobName}`);
            }
        });

        await this.copyCacheOut(writeStreams);
        await this.copyArtifactsOut(writeStreams);

        return exitCode;
    }

    private async pullImage(writeStreams: WriteStreams, imageToPull: string) {
        const time = process.hrtime();
        let pullCmd = "";
        pullCmd += `docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^${imageToPull}$'\n`;
        pullCmd += "if [ \"$?\" -ne 0 ]; then\n";
        pullCmd += `\techo "Pulling ${imageToPull}"\n`;
        pullCmd += `\tdocker pull ${imageToPull}\n`;
        pullCmd += "fi\n";
        await Utils.spawn(pullCmd, this.cwd);
        this.refreshLongRunningSilentTimeout(writeStreams);
        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright pulled} ${imageToPull} in {magenta ${prettyHrtime(endTime)}}\n`);
    }

    private async initProducerReportsDotenvVariables(writeStreams: WriteStreams) {
        const producers = this.producers;
        let producerReportsEnvs = {};
        for (const producer of producers ?? []) {
            if (producer.dotenv === null) continue;

            const safeProducerName = Utils.getSafeJobName(producer.name);
            let dotenvFile;
            if (!this.shellIsolation && !this.imageName) {
                dotenvFile = `${this.cwd}/${producer.dotenv}`;
            } else {
                dotenvFile = `${this.cwd}/.gitlab-ci-local/artifacts/${safeProducerName}/.gitlab-ci-reports/dotenv/${producer.dotenv}`;
            }
            if (await fs.pathExists(dotenvFile)) {
                const producerReportEnv = dotenv.parse(await fs.readFile(dotenvFile));
                producerReportsEnvs = {...producerReportsEnvs, ...producerReportEnv};
            } else {
                writeStreams.stderr(chalk`${this.chalkJobName} {yellow '${producer.dotenv}' produced by '${producer.name}' could not be found}\n`);
            }

        }
        return producerReportsEnvs;
    }

    private async copyCacheIn(writeStreams: WriteStreams) {
        if (this.mountCache && this.imageName) return;
        if ((!this.imageName && !this.shellIsolation) || this.cache.length === 0) return;

        for (const c of this.cache) {
            if (!["pull", "pull-push"].includes(c.policy)) return;

            const time = process.hrtime();
            const cacheName = await c.getUniqueCacheName(this.cwd, this.expandedVariables);
            const cacheFolder = `${this.cwd}/.gitlab-ci-local/cache/${cacheName}`;
            if (!await fs.pathExists(cacheFolder)) {
                continue;
            }
            this.cacheMutexMap.set(cacheName, this.cacheMutexMap.get(cacheName) ?? new Mutex());
            const mutex = this.cacheMutexMap.get(cacheName);
            assert(mutex != null, `${cacheName} could not be found in cacheMutexMap`);
            await mutex.waitForUnlock();
            await this.copyIn(cacheFolder);
            const endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright imported cache '${cacheName}'} in {magenta ${prettyHrtime(endTime)}}\n`);
        }
    }

    private async copyArtifactsIn(writeStreams: WriteStreams) {
        if ((!this.imageName && !this.shellIsolation) || (this.producers ?? []).length === 0) return;

        const time = process.hrtime();
        const promises = [];
        for (const producer of this.producers ?? []) {
            const producerSafeName = Utils.getSafeJobName(producer.name);
            const artifactFolder = `${this.cwd}/.gitlab-ci-local/artifacts/${producerSafeName}`;
            if (!await fs.pathExists(artifactFolder)) {
                throw new ExitError(`${artifactFolder} doesn't exist, did you forget --needs`);
            }
            promises.push(this.copyIn(artifactFolder));
        }
        await Promise.all(promises);
        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright imported artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
    }

    copyIn(source: string) {
        const safeJobName = this.safeJobName;
        if (!this.imageName && this.shellIsolation) {
            return Utils.spawn(`rsync -a ${source}/. ${this.cwd}/.gitlab-ci-local/builds/${safeJobName}`);
        }
        return Utils.spawn(`docker cp ${source}/. ${this._containerId}:/builds/${safeJobName}`);
    }

    private async copyCacheOut(writeStreams: WriteStreams) {
        if (this.mountCache && this.imageName) return;
        if ((!this.imageName && !this.shellIsolation) || this.cache.length === 0) return;

        let time, endTime;
        for (const c of this.cache) {
            if (!["push", "pull-push"].includes(c.policy)) return;
            const cacheName = await c.getUniqueCacheName(this.cwd, this.expandedVariables);
            for (const path of c.paths) {
                time = process.hrtime();
                const expandedPath = Utils.expandText(path, this.expandedVariables);
                let cmd = "shopt -s globstar nullglob dotglob\n";
                cmd += `mkdir -p ../../cache/${cacheName}\n`;
                cmd += `rsync -Ra ${expandedPath} ../../cache/${cacheName}/.\n`;

                this.cacheMutexMap.set(cacheName, this.cacheMutexMap.get(cacheName) ?? new Mutex());
                const mutex = this.cacheMutexMap.get(cacheName);
                assert(mutex != null, `${cacheName} could not be found in cacheMutexMap`);
                await mutex.runExclusive(async () => {
                    await this.copyOut(cmd, "cache", []);
                });
                endTime = process.hrtime(time);
                writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright exported cache ${expandedPath} '${cacheName}'} in {magenta ${prettyHrtime(endTime)}}\n`);
            }
        }
    }

    private async copyArtifactsOut(writeStreams: WriteStreams) {
        const safeJobName = this.safeJobName;

        if (!this.shellIsolation && !this.imageName || !this.artifacts) return;

        let time, endTime;
        let cpCmd = "shopt -s globstar nullglob dotglob\n";
        cpCmd += `mkdir -p ../../artifacts/${safeJobName}\n`;
        for (const artifactPath of this.artifacts?.paths ?? []) {
            const expandedPath = Utils.expandText(artifactPath, this.expandedVariables);
            cpCmd += `rsync -Ra ${expandedPath} ../../artifacts/${safeJobName}/. || true\n`;
        }

        for (const artifactExcludePath of this.artifacts?.exclude ?? []) {
            const expandedPath = Utils.expandText(artifactExcludePath, this.expandedVariables);
            cpCmd += `ls -1d '../../artifacts/${safeJobName}/${expandedPath}' | xargs -n1 rm -rf || true\n`;
        }

        const reportDotenv = this.artifacts.reports?.dotenv ?? null;
        if (reportDotenv != null) {
            cpCmd += `mkdir -p ../../artifacts/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
            cpCmd += `rsync -Ra ${reportDotenv} ../../artifacts/${safeJobName}/.gitlab-ci-reports/dotenv/.\n`;
        }

        time = process.hrtime();
        const dockerCmdExtras = this.mountCache ? [await this.mountCacheCmd(this.safeJobName, writeStreams)] : [];
        await this.copyOut(cpCmd, "artifacts", dockerCmdExtras);
        endTime = process.hrtime(time);

        const readdir = await fs.readdir(`${this.cwd}/.gitlab-ci-local/artifacts/${safeJobName}`);
        if (readdir.length === 0) {
            writeStreams.stdout(chalk`${this.chalkJobName} {yellow !! no artifacts was copied !!}\n`);
        } else {
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright exported artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        if (this.artifactsToSource) {
            time = process.hrtime();
            await Utils.spawn(`rsync --exclude=/.gitlab-ci-reports/ -a ${this.cwd}/.gitlab-ci-local/artifacts/${safeJobName}/. ${this.cwd}`);
            if (reportDotenv != null) {
                await Utils.spawn(`rsync -a ${this.cwd}/.gitlab-ci-local/artifacts/${safeJobName}/.gitlab-ci-reports/dotenv/. ${this.cwd}`);
            }
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to cwd} in {magenta ${prettyHrtime(endTime)}}\n`);
        }
    }

    private async copyOut(cmd: string, type: "artifacts" | "cache", dockerCmdExtras: string[]) {
        const safeJobName = this.safeJobName;
        const buildVolumeName = this.buildVolumeName;

        await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/${type}`);

        if (this.imageName) {
            const {stdout: cid} = await Utils.spawn(`docker create -i ${dockerCmdExtras.join(" ")} -v ${buildVolumeName}:/builds/${safeJobName}/ -w /builds/${safeJobName}/ firecow/gitlab-ci-local-util bash -c "${cmd}"`, this.cwd);
            const containerId = cid.replace(/\r?\n/g, "");
            this._containersToClean.push(containerId);
            await Utils.spawn(`docker start ${containerId} --attach`);
            await Utils.spawn(`docker cp ${containerId}:/${type}/. .gitlab-ci-local/${type}/.`, this.cwd);
        } else if (this.shellIsolation) {
            await Utils.spawn(`bash -eo pipefail -c "${cmd}"`, `${this.cwd}/.gitlab-ci-local/builds/${safeJobName}`);
        }
    }

    private refreshLongRunningSilentTimeout(writeStreams: WriteStreams) {
        clearTimeout(this._longRunningSilentTimeout);
        this._longRunningSilentTimeout = setTimeout(() => {
            writeStreams.stdout(chalk`${this.chalkJobName} {grey > still running...}\n`);
            this.refreshLongRunningSilentTimeout(writeStreams);
        }, 10000);
    }

    private getExitedString(startTime: [number, number], code: number, warning = false, prependString = "") {
        const finishedStr = this.getFinishedString(startTime);
        if (warning) {
            return chalk`${finishedStr} {black.bgYellowBright  WARN ${code.toString()} }${prependString}`;
        }

        return chalk`${finishedStr} {black.bgRed  FAIL ${code.toString()} } ${prependString}`;
    }

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        return chalk`${this.chalkJobName} {magentaBright finished} in {magenta ${timeStr}}`;
    }

    private async createDockerNetwork(networkName: string) {
        const {stdout: networkId} = await Utils.spawn(`docker network create ${networkName}`);
        this._serviceNetworkId = networkId.replace(/\r?\n/g, "");
    }

    private async startService(writeStreams: WriteStreams, service: Service, privileged: boolean) {
        let dockerCmd = `docker run -d --network gitlab-ci-local-${this.jobId} `;

        if (privileged) {
            dockerCmd += "--privileged ";
        }

        (service.getEntrypoint() ?? []).forEach((e) => {
            dockerCmd += `--entrypoint "${e}" `;
        });
        const serviceAlias = service.getAlias(this.expandedVariables);
        const serviceName = service.getName(this.expandedVariables);
        const serviceNameWithoutVersion = serviceName.replace(/(.*)(:.*)/, "$1");
        const aliases = [serviceNameWithoutVersion.replace("/", "-"), serviceNameWithoutVersion.replace("/", "__")];
        if (serviceAlias) {
            aliases.push(serviceAlias);
        }

        for(const alias of aliases) {
            dockerCmd += `--network-alias=${alias} `;
        }

        for (const [key, value] of Object.entries(this.expandedVariables)) {
            dockerCmd += `-e ${key}="${String(value).trim()}" `;
        }

        dockerCmd += `${serviceName}`;
        const command = service.getCommand(this.expandedVariables);
        if (command) {
            dockerCmd += ` ${command}`;
        }

        const time = process.hrtime();
        const {stdout: containerId} = await Utils.spawn(dockerCmd, this.cwd);
        this._containersToClean.push(containerId.replace(/\r?\n/g, ""));
        this.refreshLongRunningSilentTimeout(writeStreams);
        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright started service image: ${serviceName} with aliases: ${aliases.join(", ")}} in {magenta ${prettyHrtime(endTime)}}\n`);
    }
}
