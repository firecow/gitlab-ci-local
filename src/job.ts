import {blueBright, cyanBright, green, greenBright, magenta, magentaBright, red, redBright, yellowBright} from "ansi-colors";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import * as path from "path";
import * as prettyHrtime from "pretty-hrtime";
import {ExitError} from "./types/exit-error";
import {GitUser} from "./types/git-user";
import {Utils} from "./utils";

export class Job {

    static readonly illigalJobNames = [
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
    readonly rules?: { if: string, when: string, allow_failure: boolean }[];
    readonly expandedVariables: { [key: string]: string };
    readonly allowFailure: boolean;
    readonly when: string;

    get image(): string | null {
        return this.jobData['image'] ?? null;
    }

    get stage(): string {
        return this.jobData['stage'] || "test";
    }

    get interactive(): boolean {
        return this.jobData['interactive'] || false;
    }

    get description(): string {
        return this.jobData['description'] ?? '';
    }

    get artifacts(): { paths: string[] } {
        return this.jobData['artifacts'] || {paths: []};
    }

    get beforeScripts(): string[] {
        return this.jobData['before_script'] || [];
    }

    get afterScripts(): string[] {
        return this.jobData['after_script'] || [];
    }

    get scripts(): string[] {
        return this.jobData['script'];
    }

    get preScriptsExitCode() {
        return this._prescriptsExitCode;
    }

    private _prescriptsExitCode = 0;

    get afterScriptsExitCode() {
        return this._afterScriptsExitCode;
    }

    private _afterScriptsExitCode = 0;

    private readonly jobData: any;
    private containerId: string | null = null;
    private started = false;
    private finished = false;
    private running = false;
    private success = true;

    constructor(jobData: any, name: string, cwd: string, globals: any, pipelineIid: number, jobId: number, maxJobNameLength: number, gitUser: GitUser, userVariables: { [name: string]: string }) {
        this.maxJobNameLength = maxJobNameLength;
        this.name = name;
        this.cwd = cwd;
        this.jobId = jobId;
        this.jobData = jobData;

        this.when = jobData.when || "on_success";
        this.allowFailure = jobData.allow_failure || false;
        this.needs = jobData.needs || null;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;

        const predefinedVariables = {
            GITLAB_USER_LOGIN: gitUser["GITLAB_USER_LOGIN"],
            GITLAB_USER_EMAIL: gitUser["GITLAB_USER_EMAIL"],
            GITLAB_USER_NAME: gitUser["GITLAB_USER_NAME"],
            CI_COMMIT_SHORT_SHA: "a33bd89c", // Changes
            CI_COMMIT_SHA: "a33bd89c7b8fa3567524525308d8cafd7c0cd2ad",
            CI_PROJECT_NAME: "local-project",
            CI_PROJECT_TITLE: "LocalProject",
            CI_PROJECT_PATH_SLUG: "group/sub/local-project",
            CI_PROJECT_NAMESPACE: "group/sub/LocalProject",
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
            CI_PIPELINE_ID: `${pipelineIid + 1000}`,
            CI_PIPELINE_IID: `${pipelineIid}`,
            CI_SERVER_URL: "https://gitlab.com",
            CI_PROJECT_URL: "https://gitlab.com/group/sub/local-project",
            CI_JOB_URL: `https://gitlab.com/group/sub/local-project/-/jobs/${this.jobId}`, // Changes on rerun.
            CI_PIPELINE_URL: `https://gitlab.cego.dk/group/sub/local-project/pipelines/${pipelineIid}`,
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

        if (this.interactive && (this.when !== 'manual' || this.image !== null)) {
            throw new ExitError(`${this.getJobNameString()} @Interactive decorator cannot have image: and must be when:manual`);
        }
    }

    private getContainerName() {
        return `gcl-${this.name.replace(/[^a-zA-Z0-9_.-]/g, '-')}-${this.jobId}`;
    }

    private async spawn(command: string): Promise<string> {
        return Utils.spawn(command, {
            shell: true, env: {...this.expandedVariables, ...process.env}, cwd: this.cwd
        });
    }

    private async pullImage() {
        if (!this.image) {
            return;
        }

        const imagePlusTag = this.image.includes(':') ? this.image : `${this.image}:latest`;
        const command = `docker image ls --format '{{.Repository}}:{{.Tag}}'`;

        const listOfImages = await this.spawn(command);
        const imageLines = listOfImages.split(/\r?\n/g);

        const existingImage = imageLines.find(u => u.includes(imagePlusTag));

        if (!existingImage) {
            process.stdout.write(`${this.getJobNameString()} ${cyanBright(`pulling ${imagePlusTag}`)}\n`);

            await this.spawn(`docker pull ${imagePlusTag}`);
        }
    }

    private async removeContainer(containerId: string | null) {
        if (!this.image) {
            return;
        }
        if (!containerId) {
            return;
        }
        await this.spawn(`docker rm -f ${containerId}`);
    }

    private async copyArtifactsToHost() {
        if (!this.artifacts || !this.image) {
            return;
        }

        const containerName = this.getContainerName();

        for (let artifactPath of this.artifacts.paths || []) {
            artifactPath = Utils.expandText(artifactPath, this.expandedVariables);
            const source = `${containerName}:/gcl-wrk/${artifactPath}`;
            const target = `${this.cwd}/${path.dirname(artifactPath)}`;
            await fs.promises.mkdir(target, {recursive: true});
            await this.spawn(`docker cp ${source} ${target}`);
        }
    }

    async start(): Promise<void> {
        const startTime = process.hrtime();

        this.running = true;
        this.started = true;

        await fs.ensureFile(this.getOutputFilesPath());
        await fs.truncate(this.getOutputFilesPath());
        if (!this.interactive) {
            process.stdout.write(`${this.getStartingString()} ${this.image ? magentaBright("in docker...") : magentaBright("in shell...")}\n`);
        }

        await this.pullImage();

        const prescripts = this.beforeScripts.concat(this.scripts);
        this._prescriptsExitCode = await this.execScripts(prescripts);
        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && !this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
            this.running = false;
            this.finished = true;
            this.success = false;
            await this.removeContainer(this.containerId);
            return;
        }

        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
            this.running = false;
            this.finished = true;
            await this.removeContainer(this.containerId);
            return;
        }

        if (this._prescriptsExitCode > 0 && this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
        }

        this._afterScriptsExitCode = 0;
        if (this.afterScripts.length > 0) {
            this._afterScriptsExitCode = await this.execScripts(this.afterScripts);
        }

        if (this._afterScriptsExitCode > 0) {
            process.stderr.write(`${this.getExitedString(startTime, this._afterScriptsExitCode, true, " (after_script)")}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            this.success = false;
        }

        await this.copyArtifactsToHost();
        await this.removeContainer(this.containerId);

        process.stdout.write(`${this.getFinishedString(startTime)}\n`);

        this.running = false;
        this.finished = true;

        return;
    }

    private async execScripts(scripts: string[]): Promise<number> {
        const jobName = this.name;
        const scriptPath = `${this.cwd}/.gitlab-ci-local/shell/${jobName}.sh`;

        await fs.ensureFile(scriptPath);
        await fs.chmod(scriptPath, '777');
        await fs.truncate(scriptPath);

        let shebang;
        if (this.image) {
            const command = `docker history ${this.image} | grep -oE '[^A-Za-z0-9](sh|bash)[^A-Za-z0-9]' | grep -oE "(sh|bash)" | sort | head -n1`;
            const res = await this.spawn(command);
            if (`${res}`.length === 0) {
                throw new ExitError(`${this.image} docker image doesn't contain /bin/bash or /bin/sh`);
            }
            shebang = `#!/bin/${res}`;
        } else {
            const res = await Utils.spawn(`ls -1 /bin/ | grep -E '^bash$|^sh$' | head -n1`, {shell: true});
            if (`${res}`.length === 0) {
                throw new ExitError(`Host PC doesn't contain /bin/bash or /bin/sh`);
            }
            shebang = `#!/bin/${res}`;
        }

        await fs.appendFile(scriptPath, `${shebang}\n`);
        await fs.appendFile(scriptPath, `set -e\n\n`);

        for (const line of scripts) {
            // Print command echo'ed in color
            const split = line.split(/\r?\n/);
            const multilineText = split.length > 1 ? ' # collapsed multi-line command' : '';
            const text = split[0]?.replace(/["]/g, `\\"`).replace(/[$]/g, `\\$`);
            await fs.appendFile(scriptPath, `echo "${green(`\$ ${text}${multilineText}`)}"\n`);

            // Print command to execute
            await fs.appendFile(scriptPath, `${line}\n`);
        }

        if (this.image) {
            // Generate custom entrypoint
            const entrypointPath = `${this.cwd}/.gitlab-ci-local/entrypoint/${jobName}.sh`;
            await fs.ensureFile(entrypointPath);
            await fs.chmod(entrypointPath, '777');
            await fs.truncate(entrypointPath);
            await fs.appendFile(entrypointPath, `#!/bin/sh\n`);
            await fs.appendFile(entrypointPath, `set -e\n\n`);
            const result = await this.spawn(`docker inspect ${this.image} --format "{{ .Config.Entrypoint }}"`);
            const originalEntrypoint = result.slice(1, -2);
            if (originalEntrypoint !== '') {
                await fs.appendFile(entrypointPath, `${originalEntrypoint}\n`);
            }

            for (const [key, value] of Object.entries(this.expandedVariables)) {
                await fs.appendFile(entrypointPath, `export ${key}="${value.trim()}"\n`);
            }

            await fs.appendFile(entrypointPath, `\nexec "$@"\n`);
            const command = `docker create -w /gcl-wrk/ --entrypoint ".gitlab-ci-local/entrypoint/${this.name}.sh" --name ${this.getContainerName()} ${this.image} .gitlab-ci-local/shell/${this.name}.sh`;
            const stdout = await this.spawn(command);
            this.containerId = stdout ? stdout.replace(/\r?\n/g, '') : null;
            // TODO: Something like this should be implemented, we only want to copy tracked files into docker containers.
            // Must be asyncronous
            // const lsRes = await exec(`git ls-files`);
            // for (const file of lsRes.stdout.split(/\r?\n/g)) {
            //    await exec(`docker cp ${this.cwd}/. ${this.getContainerName()}/${file}:/gcl-wrk/`);
            // }
            await this.spawn(`docker cp ${this.cwd}/. ${this.getContainerName()}:/gcl-wrk/`);

            return await this.executeCommandHandleOutputStreams(`docker start --attach ${this.getContainerName()}`);
        }
        return await this.executeCommandHandleOutputStreams(scriptPath);
    }

    private async executeCommandHandleOutputStreams(command: string): Promise<number> {
        if (this.interactive) {
            return new Promise((_, reject) => {
                const cp = childProcess.spawn(command, {
                    stdio: 'inherit',
                    cwd: this.cwd,
                    env: {...this.expandedVariables, ...process.env}
                });
                cp.on('exit', (code) => {
                    process.exit(code ?? 0);
                });
                cp.on("error", (err) => reject(err));
            });
        }

        const jobNameStr = this.getJobNameString();
        const outputFilesPath = this.getOutputFilesPath();
        const outFunc = (e: any, stream: NodeJS.WriteStream, colorize: (str: string) => string) => {
            for (const line of `${e}`.split(/\r?\n/)) {
                if (line.length === 0) {
                    continue;
                }
                stream.write(`${jobNameStr} `);
                if (!line.startsWith('\u001b[32m$')) {
                    stream.write(`${colorize(">")} `);
                }
                stream.write(`${line}\n`);
                fs.appendFileSync(outputFilesPath, `${line}\n`);
            }
        };

        return new Promise((resolve, reject) => {
            const p = childProcess.spawn(command, {
                shell: true,
                env: {...this.expandedVariables, ...process.env},
                cwd: this.cwd
            });

            if (p.stdout) {
                p.stdout.on("data", (e) => outFunc(e, process.stdout, (s) => greenBright(s)));
            }
            if (p.stderr) {
                p.stderr.on("data", (e) => outFunc(e, process.stderr, (s) => redBright(s)));
            }

            p.on("error", (err) => reject(err));
            p.on("close", (signal) => resolve(signal ? signal : 0));
        });
    }

    private getExitedString(startTime: [number, number], code: number, warning = false, prependString = "") {
        const finishedStr = this.getFinishedString(startTime);
        if (warning) {
            return `${finishedStr} ${yellowBright(`warning with code ${code}`)} ${prependString}`;
        }

        return `${finishedStr} ${red(`exited with code ${code}`)} ${prependString}`;
    }

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        const jobNameStr = this.getJobNameString();

        return `${jobNameStr} ${magentaBright("finished")} in ${magenta(`${timeStr}`)}`;
    }

    private getStartingString() {
        const jobNameStr = this.getJobNameString();

        return `${jobNameStr} ${magentaBright("starting")}`;
    }

    getJobNameString() {
        return `${blueBright(`${this.name.padEnd(this.maxJobNameLength)}`)}`;
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
}
