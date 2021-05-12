import chalk from "chalk";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import prettyHrtime from "pretty-hrtime";
import camelCase from "camelcase";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";
import {JobOptions} from "./types/job-options";
import {WriteStreams} from "./types/write-streams";

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
    readonly rules?: { if: string; when: string; allow_failure: string | boolean }[];
    readonly expandedVariables: { [key: string]: string };
    readonly allowFailure: boolean;
    readonly when: string;
    readonly pipelineIid: number;
    readonly cache: { key: string | { files: string[] }; paths: string[] };

    private _prescriptsExitCode: number | null = null;
    private _afterScriptsExitCode = 0;
    private _coveragePercent: string | null = null;
    private _running = false;
    private _containerId: string | null = null;
    private _artifactsContainerId: string | null = null;
    private _containerVolumeName: string | null = null;
    private _longRunningSilentTimeout: NodeJS.Timeout = -1 as any;

    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;
    private readonly extraHosts: string[];

    constructor(opt: JobOptions) {
        const jobData = opt.data;
        const gitUser = opt.gitUser;
        const gitRemote = opt.gitRemote;
        const globals = opt.globals;
        const homeVariables = opt.homeVariables;

        this.extraHosts = opt.extraHosts;
        this.writeStreams = opt.writeStreams;
        this.jobNamePad = opt.namePad;
        this.name = opt.name;
        this.cwd = opt.cwd;
        this.jobId = opt.id;
        this.jobData = opt.data;
        this.pipelineIid = opt.pipelineIid;

        this.when = jobData.when || "on_success";
        this.allowFailure = jobData.allow_failure != null ? jobData.allow_failure == "true" : false;
        this.needs = jobData.needs || null;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;
        this.cache = jobData.cache || null;

        const predefinedVariables = {
            GITLAB_USER_LOGIN: gitUser["GITLAB_USER_LOGIN"],
            GITLAB_USER_EMAIL: gitUser["GITLAB_USER_EMAIL"],
            GITLAB_USER_NAME: gitUser["GITLAB_USER_NAME"],
            CI_COMMIT_SHORT_SHA: "a33bd89c", // Changes
            CI_COMMIT_SHA: "a33bd89c7b8fa3567524525308d8cafd7c0cd2ad",
            CI_PROJECT_DIR: this.imageName ? "/builds/" : `${this.cwd}`,
            CI_PROJECT_NAME: gitRemote.project,
            CI_PROJECT_TITLE: `${camelCase(gitRemote.project)}`,
            CI_PROJECT_PATH: `${gitRemote.group}/${camelCase(gitRemote.project)}`,
            CI_PROJECT_PATH_SLUG: `${gitRemote.group.replace(/\//g, "-")}-${gitRemote.project}`,
            CI_PROJECT_NAMESPACE: `${gitRemote.group}`,
            CI_COMMIT_REF_PROTECTED: "false",
            CI_COMMIT_BRANCH: "local/branch", // Branch name, only when building branches
            CI_COMMIT_REF_NAME: "local/branch", // Tag or branch name
            CI_PROJECT_VISIBILITY: "internal",
            CI_PROJECT_ID: "1217",
            CI_COMMIT_REF_SLUG: "local-branch",
            CI_COMMIT_TITLE: "Commit Title", // First line of commit message.
            CI_COMMIT_MESSAGE: "Commit Title\nMore commit text", // Full commit message
            CI_COMMIT_DESCRIPTION: "More commit text",
            CI_PIPELINE_SOURCE: "push",
            CI_JOB_ID: `${this.jobId}`, // Changes on rerun
            CI_PIPELINE_ID: `${this.pipelineIid + 1000}`,
            CI_PIPELINE_IID: `${this.pipelineIid}`,
            CI_SERVER_HOST: `${gitRemote.domain}`,
            CI_SERVER_URL: `https://${gitRemote.domain}:443`,
            CI_API_V4_URL: `https://${gitRemote.domain}/api/v4`,
            CI_PROJECT_URL: `https://${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}`,
            CI_JOB_URL: `https://${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}/-/jobs/${this.jobId}`, // Changes on rerun.
            CI_PIPELINE_URL: `https://${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}/pipelines/${this.pipelineIid}`,
            CI_JOB_NAME: `${this.name}`,
            CI_JOB_STAGE: `${this.stage}`,
            GITLAB_CI: "false",
        };

        // Create expanded variables
        const envs = {...globals.variables || {}, ...jobData.variables || {}, ...predefinedVariables, ...process.env};
        const expandedGlobalVariables = Utils.expandVariables(globals.variables || {}, envs);
        const expandedJobVariables = Utils.expandVariables(jobData.variables || {}, envs);

        this.expandedVariables = {...expandedGlobalVariables, ...expandedJobVariables, ...homeVariables, ...predefinedVariables};

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

    get chalkJobName() {
        return chalk`{blueBright ${this.name.padEnd(this.jobNamePad)}}`;
    }

    get safeJobName() {
        const emojiRegex = /(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?(?:\u200d(?:[^\ud800-\udfff]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff])[\ufe0e\ufe0f]?(?:[\u0300-\u036f\ufe20-\ufe23\u20d0-\u20f0]|\ud83c[\udffb-\udfff])?)*/g;
        return this.name.replace(/ /g, "_").replace(emojiRegex, "_");
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
        if (!image) {
            return null;
        }
        if (typeof image.entrypoint !== "object") {
            throw new ExitError("image:entrypoint must be an array");
        }
        return image.entrypoint;
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

    get artifacts(): { paths: string[] } {
        return this.jobData["artifacts"] || {paths: []};
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

        this._running = true;
        this.refreshLongRunningSilentTimeout(writeStreams);

        await fs.ensureFile(`${this.cwd}/.gitlab-ci-local/output/${this.name}.log`);
        await fs.truncate(`${this.cwd}/.gitlab-ci-local/output/${this.name}.log`);

        if (!this.imageName) {
            const {hrdeltatime} = await Utils.rsyncNonIgnoredFilesToBuilds(this.cwd, this.name);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright rsynced to build folder} in {magenta ${prettyHrtime(hrdeltatime)}}\n`);
        }

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
            this._coveragePercent = await Utils.getCoveragePercent(this.cwd, this.jobData.coverage, this.name);
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
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._artifactsContainerId) {
            try {
                await Utils.spawn(`docker rm -f ${this._artifactsContainerId}`);
            } catch(e) {
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._containerVolumeName) {
            try {
                await Utils.spawn(`docker volume rm ${this._containerVolumeName}`);
            } catch (e) {
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }
    }

    private generateInjectSSHAgentOptions() {
        if (!this.injectSSHAgent) {
            return "";
        }
        if (process.env.OSTYPE === "darwin") {
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
        const outputFilesPath = `${this.cwd}/.gitlab-ci-local/output/${this.name}.log`;
        const writeStreams = this.writeStreams;
        const artifactsFrom = this.needs || this.dependencies;
        let time;
        let endTime;

        if (scripts.length === 0 || scripts[0] == null) {
            return 0;
        }

        if (this.interactive) {
            let iCmd = "";
            for (const [key, value] of Object.entries(this.expandedVariables)) {
                iCmd += `export ${key}="${String(value).trim()}"\n`;
            }
            iCmd += this.generateScriptCommands(scripts);

            const cp = childProcess.spawn(iCmd, {
                shell: "bash",
                stdio: ["inherit", "inherit", "inherit"],
                cwd: this.cwd,
            });
            return new Promise<number>((resolve, reject) => {
                cp.on("exit", (code) => resolve(code ?? 0));
                cp.on("error", (err) => reject(err));
            });
        }

        if (this.imageName) {
            time = process.hrtime();
            let pullCmd = "";
            pullCmd += `docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^${this.imageName}$'\n`;
            pullCmd += "if [ \"$?\" -ne 0 ]; then\n";
            pullCmd += `\techo "Pulling ${this.imageName}"\n`;
            pullCmd += `\tdocker pull ${this.imageName}\n`;
            pullCmd += "fi\n";
            await Utils.spawn(pullCmd, this.cwd);
            this.refreshLongRunningSilentTimeout(writeStreams);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright pulled} ${this.imageName} in {magenta ${prettyHrtime(endTime)}}\n`);

            let dockerCmd = "";
            if (privileged) {
                dockerCmd += `docker create --privileged -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            } else {
                dockerCmd += `docker create -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            }

            this._containerVolumeName = `gcl-${this.safeJobName}-${this.jobId}`;
            await Utils.spawn(`docker volume create ${this._containerVolumeName}`, this.cwd);
            dockerCmd += `--volume ${this._containerVolumeName}:/builds/ `;

            for (const extraHost of this.extraHosts) {
                dockerCmd += `--add-host=${extraHost} `;
            }

            if (this.imageEntrypoint) {
                this.imageEntrypoint.forEach((e) => {
                    dockerCmd += `--entrypoint "${e}" `;
                });
            }

            for (const [key, value] of Object.entries(this.expandedVariables)) {
                dockerCmd += `-e ${key}="${String(value).trim()}" `;
            }

            if (this.cache && this.cache.key && typeof this.cache.key === "string" && this.cache.paths) {
                this.cache.paths.forEach((path) => {
                    writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright mounting cache} for path ${path}\n`);
                    // /tmp/ location instead of .gitlab-ci-local/cache avoids the (unneeded) inclusion of cache folders when docker copy all files into the container, thus saving time for all jobs
                    dockerCmd += `-v /tmp/gitlab-ci-local/cache/${this.cache.key}/${path}:/builds/${path} `;
                });
            }

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

            const {stdout: containerId} = await Utils.spawn(dockerCmd, this.cwd, {...process.env, ...this.expandedVariables});
            this._containerId = containerId.replace(/\r?\n/g, "");

            time = process.hrtime();
            await Utils.spawn(`docker cp .gitlab-ci-local/builds/.docker/. ${this._containerId}:/builds/`, this.cwd);
            this.refreshLongRunningSilentTimeout(writeStreams);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied source to container} in {magenta ${prettyHrtime(endTime)}}\n`);

            if (artifactsFrom === null || artifactsFrom.length > 0) {
                time = process.hrtime();
                await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/`);
                await Utils.spawn(`docker cp ${this.cwd}/.gitlab-ci-local/artifacts/. ${this._containerId}:/builds/`);
                this.refreshLongRunningSilentTimeout(writeStreams);
                endTime = process.hrtime(time);
                writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to container} in {magenta ${prettyHrtime(endTime)}}\n`);
            }

            await Utils.spawn(`docker run --rm -w /builds/ -v ${this._containerVolumeName}:/builds/ debian:stable-slim bash -c "chown root:root -R . && chmod a=rw -R ."`);
        }

        if (this.imageName === null && (artifactsFrom === null || artifactsFrom.length > 0)) {
            time = process.hrtime();
            await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/`);
            await Utils.spawn(`rsync -a ${this.cwd}/.gitlab-ci-local/artifacts/. ${this.cwd}`);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to cwd} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        let cmd = "set -eo pipefail\n";
        cmd += "exec 0< /dev/null\n";

        if (this.imageName) {
            cmd += "cd /builds/\n";
        } else {
            for (const [key, value] of Object.entries(this.expandedVariables)) {
                cmd += `export ${key}="${String(value).trim()}"\n`;
            }
        }

        cmd += this.generateScriptCommands(scripts);

        cmd += "exit 0\n";

        await fs.outputFile(`${this.cwd}/.gitlab-ci-local/scripts/${this.safeJobName}`, cmd, "utf-8");
        await fs.chmod(`${this.cwd}/.gitlab-ci-local/scripts/${this.safeJobName}`, "0755");

        if (this.imageName) {
            await Utils.spawn(`docker cp .gitlab-ci-local/scripts/. ${this._containerId}:/gcl-scripts/`, this.cwd);
        }

        const cp = childProcess.spawn(this._containerId ? `docker start --attach -i ${this._containerId}` : "bash", {
            shell: "bash",
            stdio: ["pipe", "pipe", "pipe"],
            cwd: this.cwd,
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
                cp.stdin.end(`/gcl-scripts/${this.safeJobName}`);
            } else {
                cp.stdin.end(`./.gitlab-ci-local/scripts/${this.safeJobName}`);
            }
        });

        if (this.imageName && this.artifacts.paths.length > 0) {
            let cpCmd = "shopt -s globstar\nmkdir -p /artifacts/\n";
            for (const artifactPath of this.artifacts.paths) {
                const expandedPath = Utils.expandText(artifactPath, this.expandedVariables);
                cpCmd += `echo Started copying ${expandedPath} to /artifacts\n`;
                cpCmd += "cd /builds/\n";
                cpCmd += `cp -r --parents ${expandedPath} /artifacts\n`;
                cpCmd += `echo Done copying ${expandedPath} to /artifacts\n`;
            }

            time = process.hrtime();
            const {stdout: artifactsContainerId} = await Utils.spawn(`docker create -i -v ${this._containerVolumeName}:/builds/ debian:stable-slim bash -c "${cpCmd}"`, this.cwd);
            this._artifactsContainerId = artifactsContainerId.replace(/\r?\n/g, "");
            await Utils.spawn(`docker start ${this._artifactsContainerId} --attach`);
            await Utils.spawn(`docker cp ${this._artifactsContainerId}:/artifacts .gitlab-ci-local/.`, this.cwd);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright saved artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        return exitCode;
    }

    private refreshLongRunningSilentTimeout(writeStreams: WriteStreams) {
        clearTimeout(this._longRunningSilentTimeout);
        this._longRunningSilentTimeout = setTimeout(() => {
            writeStreams.stdout(chalk`${this.chalkJobName} {grey > still running...}\n`);
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
}
