import * as chalk from "chalk";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import * as prettyHrtime from "pretty-hrtime";
import * as camelCase from "camelcase";
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
    readonly needs: string[] | null;
    readonly dependencies: string[] | null;
    readonly maxJobNameLength: number;
    readonly environment?: { name: string, url: string | null };
    readonly jobId: number;
    readonly cwd: string;
    readonly rules?: { if: string, when: string, allow_failure: string|boolean }[];
    readonly expandedVariables: { [key: string]: string };
    readonly allowFailure: boolean;
    readonly when: string;
    readonly pipelineIid: number;
    readonly cache: { key: string | { files: string[] }, paths: string[] };
    private _prescriptsExitCode = 0;
    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;
    private started = false;
    private finished = false;
    private running = false;
    private success = true;
    private containerId: string | null = null;

    constructor(opt: JobOptions) {
        const jobData = opt.jobData;
        const gitUser = opt.gitUser;
        const gitRemote = opt.gitRemote;
        const globals = opt.globals;
        const userVariables = opt.userVariables;

        this.writeStreams = opt.writeStreams;
        this.maxJobNameLength = opt.maxJobNameLength;
        this.name = opt.name;
        this.cwd = opt.cwd;
        this.jobId = opt.jobId;
        this.jobData = opt.jobData;
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

        this.expandedVariables = {...expandedGlobalVariables, ...expandedJobVariables, ...userVariables, ...predefinedVariables};

        // Set {when, allowFailure} based on rules result
        if (this.rules) {
            const ruleResult = Utils.getRulesResult(this.rules, this.expandedVariables);
            this.when = ruleResult.when;
            this.allowFailure = ruleResult.allowFailure;
        }

        if (this.interactive && (this.when !== "manual" || this.imageName !== null)) {
            throw new ExitError(`${this.getJobNameString()} @Interactive decorator cannot have image: and must be when:manual`);
        }

        if (this.injectSSHAgent && this.imageName === null) {
            throw new ExitError(`${this.getJobNameString()} @InjectSSHAgent can only be used with image:`);
        }
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

    private _afterScriptsExitCode = 0;

    get afterScriptsExitCode() {
        return this._afterScriptsExitCode;
    }

    async start(privileged: boolean): Promise<void> {
        const startTime = process.hrtime();
        const writeStreams = this.writeStreams;

        this.running = true;
        this.started = true;

        await fs.ensureFile(this.getOutputFilesPath());
        await fs.truncate(this.getOutputFilesPath());
        if (!this.interactive) {
            const jobNameStr = this.getJobNameString();
            writeStreams.stdout(chalk`${jobNameStr} {magentaBright starting} ${this.imageName ?? "shell"} ({yellow ${this.stage}})\n`);
        }

        const prescripts = this.beforeScripts.concat(this.scripts);
        this._prescriptsExitCode = await this.execScripts(prescripts, privileged);
        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && !this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
            this.running = false;
            this.finished = true;
            this.success = false;
            await this.removeContainer();
            return;
        }

        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
            this.running = false;
            this.finished = true;
            await this.removeContainer();
            return;
        }

        if (this._prescriptsExitCode > 0 && this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
        }

        this._afterScriptsExitCode = 0;
        if (this.afterScripts.length > 0) {
            this._afterScriptsExitCode = await this.execScripts(this.afterScripts, privileged);
        }

        if (this._afterScriptsExitCode > 0) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._afterScriptsExitCode, true, " (after_script)")}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            this.success = false;
        }

        writeStreams.stdout(`${this.getFinishedString(startTime)}\n`);

        this.running = false;
        this.finished = true;

        await this.removeContainer();
    }

    getJobNameString() {
        return chalk`{blueBright ${this.name.padEnd(this.maxJobNameLength)}}`;
    }

    getOutputFilesPath() {
        return `${this.cwd}/.gitlab-ci-local/output/${this.name}.log`;
    }

    isFinished() {
        return this.finished;
    }

    isStarted() {
        return this.started;
    }

    isManual() {
        return this.when === "manual";
    }

    isNever() {
        return this.when === "never";
    }

    isRunning() {
        return this.running;
    }

    isSuccess() {
        return this.success;
    }

    setFinished(finished: boolean) {
        this.finished = finished;
    }

    public async removeContainer() {
        if (this.containerId) {
            await Utils.spawn(`docker rm -f ${this.containerId}`);
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

    private async execScripts(scripts: string[], privileged: boolean): Promise<number> {
        const jobNameStr = this.getJobNameString();
        const outputFilesPath = this.getOutputFilesPath();
        const writeStreams = this.writeStreams;
        const artifactsFrom = this.needs || this.dependencies;
        let time;
        let endTime;

        if (scripts.length === 0 || scripts[0] == null) {
            return 0;
        }

        if (this.interactive) {
            let cmd = "";
            for (const [key, value] of Object.entries(this.expandedVariables)) {
                cmd += `export ${key}="${String(value).trim()}"\n`;
            }

            scripts.forEach((script) => {
                // Print command echo'ed in color
                const split = script.split(/\r?\n/);
                const multilineText = split.length > 1 ? " # collapsed multi-line command" : "";
                const text = split[0]?.replace(/["]/g, "\\\"").replace(/[$]/g, "\\$");
                cmd += chalk`echo "{green ${`$ ${text}${multilineText}`}}"\n`;

                // Execute actual script
                cmd += `${script}\n`;
            });
            const cp = childProcess.spawn(cmd, {
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
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.getJobNameString()} {magentaBright pulled} ${this.imageName} in {magenta ${prettyHrtime(endTime)}}\n`);

            let dockerCmd = "";
            if (privileged) {
                dockerCmd += `docker create --privileged -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            } else {
                dockerCmd += `docker create -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
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
                    writeStreams.stdout(chalk`${jobNameStr} {magentaBright mounting cache} for path ${path}\n`);
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

            const {stdout: containerId} = await Utils.spawn(dockerCmd, this.cwd, {...process.env, ...this.expandedVariables,});
            this.containerId = containerId.replace("\n", "");

            time = process.hrtime();
            await Utils.spawn(`docker cp . ${this.containerId}:/builds/`, this.cwd);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.getJobNameString()} {magentaBright copied source to container} in {magenta ${prettyHrtime(endTime)}}\n`);

            if (artifactsFrom === null || artifactsFrom.length > 0) {
                time = process.hrtime();
                await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/`);
                await Utils.spawn(`docker cp ${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/. ${this.containerId}:/builds/`);
                endTime = process.hrtime(time);
                writeStreams.stdout(chalk`${this.getJobNameString()} {magentaBright copied artifacts to container} in {magenta ${prettyHrtime(endTime)}}\n`);
            }
        }

        if (this.imageName === null && (artifactsFrom === null || artifactsFrom.length > 0)) {
            time = process.hrtime();
            await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/`);
            await Utils.spawn(`rsync -a ${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/. ${this.cwd}`);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.getJobNameString()} {magentaBright copied artifacts to cwd} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        let cmd = "";
        cmd += "set -eo pipefail\n";
        cmd += "exec 0<> /dev/null\n";

        if (this.imageName) {
            cmd += "cd /builds/\n";
            cmd += "chown root:root -R .\n";
            cmd += "chmod a+w -R .\n";
        } else {
            for (const [key, value] of Object.entries(this.expandedVariables)) {
                cmd += `export ${key}="${String(value).trim()}"\n`;
            }
        }

        for (const script of scripts) {
            // Print command echo'ed in color
            const split = script.split(/\r?\n/);
            const multilineText = split.length > 1 ? " # collapsed multi-line command" : "";
            const text = split[0]?.replace(/["]/g, "\\\"").replace(/[$]/g, "\\$");
            cmd += chalk`echo "{green ${`$ ${text}${multilineText}`}}"\n`;

            // Execute actual script
            cmd += `${script}\n`;
        }

        cmd += "exit 0\n";

        // const dockCmd = `docker start --attach -i ${this.containerId} < ${cmd}`;
        // const bashCmd = `bash --login -c "${cmd}"`;
        // const cpCmd = this.containerId ? dockCmd : bashCmd;
        const cp = childProcess.spawn(this.containerId ? `docker start --attach -i ${this.containerId}\n${cmd}` : cmd, {
            shell: "bash",
            stdio: ["pipe", "pipe", "pipe"],
            cwd: this.cwd,
        });

        const outFunc = (e: any, stream: (txt: string) => void, colorize: (str: string) => string) => {
            for (const line of `${e}`.split(/\r?\n/)) {
                if (line.length === 0) {
                    continue;
                }

                stream(`${jobNameStr} `);
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

            cp.on("exit", (code) => resolve(code ?? 0));
            cp.on("error", (err) => reject(err));
        });

        if (this.imageName) {
            for (const artifactPath of this.artifacts.paths) {
                const expandedPath = Utils.expandText(artifactPath, this.expandedVariables).replace(/\/$/, "");

                time = process.hrtime();

                await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/`);

                let pathReplacement = "";
                if (`${expandedPath}`.match(/(.*)\/(.+)/)) {
                    // in case of a folder, create the full path
                    await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/${expandedPath.replace(/(.*)\/(.+)/, "$1")}`);
                    pathReplacement = `${expandedPath.replace(/(.*)\/(.+)/, "$1")}`;
                }

                try {
                    await Utils.spawn(`docker cp ${this.containerId}:/builds/${expandedPath} ${this.cwd}/.gitlab-ci-local/artifacts/${this.pipelineIid}/${pathReplacement}`);
                    endTime = process.hrtime(time);
                    writeStreams.stdout(chalk`${this.getJobNameString()} {magentaBright saved artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
                } catch (e) {
                    // exact same message and color as Gitlab runner
                    writeStreams.stdout(chalk`${this.getJobNameString()} {yellow WARNING: ${artifactPath}: no matching files}\n`);
                }
            }
        }

        return exitCode;
    }

    private getExitedString(startTime: [number, number], code: number, warning = false, prependString = "") {
        const finishedStr = this.getFinishedString(startTime);
        if (warning) {
            return chalk`${finishedStr} {yellowBright warning with code ${code.toString()}} ${prependString}`;
        }

        return chalk`${finishedStr} {red exited with code ${code.toString()}} ${prependString}`;
    }

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        const jobNameStr = this.getJobNameString();

        return chalk`${jobNameStr} {magentaBright finished} in {magenta ${timeStr}}`;
    }
}
