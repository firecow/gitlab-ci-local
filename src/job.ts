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
import {GitData} from "./types/git-data";
import {assert} from "./asserts";

export class Job {

    static readonly illegalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "workflow",
    ];

    readonly name: string;
    readonly jobNamePad: number;
    readonly needs: string[] | null;
    readonly dependencies: string[] | null;
    readonly environment?: { name: string; url: string | null };
    readonly jobId: number;
    readonly cwd: string;
    readonly rules?: { if: string; when: string; allow_failure: boolean }[];
    readonly expandedVariables: { [key: string]: string };
    readonly allowFailure: boolean;
    readonly when: string;
    readonly pipelineIid: number;
    readonly cache: { key: string | { files: string[] }; paths: string[] }[];
    readonly gitData: GitData;
    readonly shellIsolation: boolean;

    private _prescriptsExitCode: number | null = null;
    private _afterScriptsExitCode = 0;
    private _coveragePercent: string | null = null;
    private _running = false;
    private _containerId: string | null = null;
    private _serviceIds: string[] = [];
    private _serviceNetworkId: string | null = null;
    private _artifactsContainerId: string | null = null;
    private _containerVolumeNames: string[] = [];
    private _longRunningSilentTimeout: NodeJS.Timeout = -1 as any;
    private _producers: { name: string; dotenv: string | null }[] | null = null;

    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;
    private readonly extraHosts: string[];
    private readonly volumes: string[];

    constructor(opt: JobOptions) {
        const jobData = opt.data;
        const gitData = opt.gitData;
        const globals = opt.globals;
        const homeVariables = opt.homeVariables;

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
        this.needs = jobData.needs || null;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;
        this.cache = jobData.cache || [];

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
            CI_SERVER_HOST: `${gitData.remote.domain}`,
            CI_SERVER_URL: `https://${gitData.remote.domain}:443`,
            CI_API_V4_URL: `https://${gitData.remote.domain}/api/v4`,
            CI_PROJECT_URL: `https://${gitData.remote.domain}/${gitData.remote.group}/${gitData.remote.project}`,
            CI_JOB_URL: `https://${gitData.remote.domain}/${gitData.remote.group}/${gitData.remote.project}/-/jobs/${this.jobId}`, // Changes on rerun.
            CI_PIPELINE_URL: `https://${gitData.remote.domain}/${gitData.remote.group}/${gitData.remote.project}/pipelines/${this.pipelineIid}`,
            CI_JOB_NAME: `${this.name}`,
            CI_JOB_STAGE: `${this.stage}`,
            CI_REGISTRY: gitData.CI_REGISTRY,
            CI_REGISTRY_IMAGE: gitData.CI_REGISTRY_IMAGE,
            GITLAB_CI: "false",
        };

        // Create expanded variables
        const envs = {...globals.variables || {}, ...jobData.variables || {}, ...predefinedVariables, ...homeVariables};
        const expandedGlobalVariables = Utils.expandVariables(globals.variables || {}, envs);
        const expandedJobVariables = Utils.expandVariables(jobData.variables || {}, envs);
        this.expandedVariables = {...expandedGlobalVariables, ...expandedJobVariables, ...predefinedVariables, ...homeVariables};

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
    }

    static async getUniqueCacheName(cwd: string, cacheEntry: { key: string | { files: string[] }; paths: string[] }) {
        if (typeof cacheEntry.key === "string") {
            return cacheEntry.key;
        }
        return "md-" + await Utils.checksumFiles(cacheEntry.key.files.map((f) => `${cwd}/${f}`));
    }

    get chalkJobName() {
        return chalk`{blueBright ${this.name.padEnd(this.jobNamePad)}}`;
    }

    get safeJobName() {
        return Utils.getSafeJobName(this.name);
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

        if (this._containerId) {
            try {
                await Utils.spawn(`docker rm -f ${this._containerId}`);
            } catch (e) {
                assert(e instanceof Error, "e is not instanceof Error");
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._serviceIds) {
            try {
                for (const serviceId of this._serviceIds) {
                    await Utils.spawn(`docker rm -f ${serviceId}`);
                }
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

        if (this._artifactsContainerId) {
            try {
                await Utils.spawn(`docker rm -f ${this._artifactsContainerId}`);
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

    private async generateInjectSSHAgentOptions() {
        if (!this.injectSSHAgent) {
            return "";
        }

        if (await fs.pathExists("/run/host-services/ssh-auth.sock")) {
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
            const text = split[0]?.replace(/["]/g, "\\\"").replace(/[$]/g, "\\$");
            cmd += chalk`echo "{green $ ${text}${multilineText}}"\n`;

            // Execute actual script
            cmd += `${script}\n`;
        });
        return cmd;
    }

    private async execScripts(scripts: string[], privileged: boolean): Promise<number> {
        const safeJobName = this.safeJobName;
        const outputFilesPath = `${this.cwd}/.gitlab-ci-local/output/${safeJobName}.log`;
        const buildVolumeName = `gcl-${this.safeJobName}-${this.jobId}-build`;
        const tmpVolumeName = `gcl-${this.safeJobName}-${this.jobId}-tmp`;
        const writeStreams = this.writeStreams;
        const reportsDotenvVariables = await this.initProducerReportsDotenvVariables(writeStreams);
        let time;
        let endTime;

        if (scripts.length === 0 || scripts[0] == null) {
            return 0;
        }

        // Copy git tracked files to build folder if shell isolation enabled.
        if (!this.imageName && this.shellIsolation) {
            await Utils.rsyncNonIgnoredFilesToBuilds(this.cwd, `${safeJobName}`);
        }

        if (this.interactive) {
            const iCmd = this.generateScriptCommands(scripts);
            const cp = childProcess.spawn(iCmd, {
                shell: "bash",
                stdio: ["inherit", "inherit", "inherit"],
                cwd: this.cwd,
                env: {...this.expandedVariables, ...process.env},
            });
            return new Promise<number>((resolve, reject) => {
                cp.on("exit", (code) => resolve(code ?? 0));
                cp.on("error", (err) => reject(err));
            });
        }

        this.refreshLongRunningSilentTimeout(writeStreams);

        if (this.imageName) {
            await this.pullImage(writeStreams, this.imageName);

            let dockerCmd = "";
            const injectSSSHAgentOptions = await this.generateInjectSSHAgentOptions();
            if (privileged) {
                dockerCmd += `docker create --privileged -u 0:0 -i ${injectSSSHAgentOptions} `;
            } else {
                dockerCmd += `docker create -u 0:0 -i ${injectSSSHAgentOptions} `;
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

            dockerCmd += await this.createCacheDockerVolumeMounts(safeJobName, writeStreams);

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

        await this.copyArtifactsIn(writeStreams);

        if (this.imageName) {
            // Make sure tracked files and artifacts are root owned in docker-executor jobs.
            await Utils.spawn(`docker run --rm -w /app/ -v ${buildVolumeName}:/app/ debian:stable-slim bash -c "chown 0:0 -R . && chmod a+rw -R ."`);
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

        await this.copyArtifactsOut(writeStreams, buildVolumeName);

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

    private async copyArtifactsIn(writeStreams: WriteStreams) {
        if (!this.imageName && !this.shellIsolation) {
            return;
        }

        if (!this.producers || this.producers.length === 0) {
            return;
        }

        const safeJobName = this.safeJobName;

        const cpFunc = async (folder: string) => {
            if (!this.imageName && this.shellIsolation) {
                return Utils.spawn(`cp -R ${folder}/. ${this.cwd}/.gitlab-ci-local/builds/${safeJobName}`);
            }
            return Utils.spawn(`docker cp ${folder}/. ${this._containerId}:/builds/${safeJobName}`);
        };

        const time = process.hrtime();
        const promises = [];
        for (const producer of this.producers) {
            const producerSafeName = Utils.getSafeJobName(producer.name);
            const artifactFolder = `${this.cwd}/.gitlab-ci-local/artifacts/${producerSafeName}`;
            if (!await fs.pathExists(artifactFolder)) {
                throw new ExitError(`${artifactFolder} doesn't exist, did you forget --needs`);
            }
            promises.push(cpFunc(artifactFolder));
        }
        await Promise.all(promises);
        const endTime = process.hrtime(time);
        const targetText = this.imageName ? "container" : "isolated shell";
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to ${targetText}} in {magenta ${prettyHrtime(endTime)}}\n`);
    }

    private async copyArtifactsOut(writeStreams: WriteStreams, buildVolumeName: string) {
        const safeJobName = this.safeJobName;

        if (!this.shellIsolation && !this.imageName || !this.artifacts) {
            return;
        }

        let time, endTime;
        let cpCmd = "shopt -s globstar nullglob dotglob\n";
        cpCmd += `mkdir -p ../../artifacts/${safeJobName}\n`;
        for (const artifactPath of this.artifacts?.paths ?? []) {
            const expandedPath = Utils.expandText(artifactPath, this.expandedVariables);
            cpCmd += `echo Started copying ${expandedPath} to ../../artifacts/${safeJobName}\n`;
            cpCmd += `cp -r --parents ${expandedPath} ../../artifacts/${safeJobName}\n`;
            cpCmd += `echo Done copying ${expandedPath} to ../../artifacts/${safeJobName}\n`;
        }

        for (const artifactExcludePath of this.artifacts?.exclude ?? []) {
            const expandedPath = Utils.expandText(artifactExcludePath, this.expandedVariables);
            cpCmd += `echo Started removing exclude '${expandedPath}' from ../../artifacts/${safeJobName}\n`;
            cpCmd += `cd ../../artifacts/${safeJobName}\n`;
            cpCmd += `gcil_exclude=\\"${expandedPath}\\"\n`;
            cpCmd += "IFS=''\n";
            cpCmd += "for f in \\${gcil_exclude}; do\n";
            cpCmd += "\tprintf \\\"%s\\0\\\" \\\"\\$f\\\"\n";
            cpCmd += "done | sort --zero-terminated --reverse | xargs --no-run-if-empty --null rm --dir\n";
            cpCmd += `echo Done removing exclude '${expandedPath}' from ../../artifacts/${safeJobName}\n`;
        }

        const reportDotenv = this.artifacts.reports?.dotenv ?? null;
        if (reportDotenv != null) {
            cpCmd += `mkdir -p ../../artifacts/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
            cpCmd += `echo Started copying ${reportDotenv} to ../../artifacts/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
            cpCmd += `cp -r --parents ${reportDotenv} ../../artifacts/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
            cpCmd += `echo Done copying ${reportDotenv} to ../../artifacts/${safeJobName}/.gitlab-ci-reports/dotenv\n`;
        }

        time = process.hrtime();
        if (this.imageName) {
            const cacheMountStr = await this.createCacheDockerVolumeMounts(safeJobName, writeStreams);
            const dockerCreateCmd = `docker create -i ${cacheMountStr} -v ${buildVolumeName}:/builds/${safeJobName}/ -w /builds/${safeJobName}/ debian:stable-slim bash -c "${cpCmd}"`;
            const {stdout: artifactsContainerId} = await Utils.spawn(dockerCreateCmd, this.cwd);
            this._artifactsContainerId = artifactsContainerId.replace(/\r?\n/g, "");
            await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/${safeJobName}`);
            await Utils.spawn(`docker start ${this._artifactsContainerId} --attach`);
            await Utils.spawn(`docker cp ${this._artifactsContainerId}:/artifacts/. .gitlab-ci-local/artifacts/.`, this.cwd);
        } else if (this.shellIsolation) {
            await Utils.spawn(`mkdir -p ../../artifacts/${safeJobName}`, `${this.cwd}/.gitlab-ci-local/builds/${safeJobName}`);
            await Utils.spawn(`bash -e -c "${cpCmd}"`, `${this.cwd}/.gitlab-ci-local/builds/${safeJobName}`);
        }
        endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright saved artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);

        // Copy job artifacts to hosts "real" cwd
        time = process.hrtime();
        await Utils.spawn(`rsync --exclude=/.gitlab-ci-reports/ -a ${this.cwd}/.gitlab-ci-local/artifacts/${safeJobName}/. ${this.cwd}`);
        if (reportDotenv != null) {
            await Utils.spawn(`rsync -a ${this.cwd}/.gitlab-ci-local/artifacts/${safeJobName}/.gitlab-ci-reports/dotenv/. ${this.cwd}`);
        }
        endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to cwd} in {magenta ${prettyHrtime(endTime)}}\n`);
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

    private async createCacheDockerVolumeMounts(safeJobName: string, writeStreams: WriteStreams) {
        let cmd = "";
        for (const entry of this.cache) {
            const uniqueCacheName = await Job.getUniqueCacheName(this.cwd, entry);
            entry.paths.forEach((path) => {
                writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright mounting cache} for path ${path}\n`);
                cmd += `-v /tmp/gitlab-ci-local/cache/${uniqueCacheName}/${path}:/builds/${safeJobName}/${path} `;
            });
        }
        return cmd;
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
        this._serviceIds.push(containerId.replace(/\r?\n/g, ""));
        this.refreshLongRunningSilentTimeout(writeStreams);
        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright started service image: ${serviceName} with aliases: ${aliases.join(", ")}} in {magenta ${prettyHrtime(endTime)}}\n`);
    }
}
