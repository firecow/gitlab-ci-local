import * as c from "ansi-colors";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import * as deepExtend from "deep-extend";
import * as clone from "clone";
import * as prettyHrtime from "pretty-hrtime";
import * as util from "util";
import * as path from "path";

const exec = util.promisify(childProcess.exec);

export class Job {
    public readonly name: string;
    public readonly needs: string[] | null;
    public readonly dependencies: string[] | null;
    public readonly stage: string;
    public readonly maxJobNameLength: number;
    public readonly stageIndex: number;
    public readonly environment: { name: string|null, url: string|null } | null;
    public readonly image: string | null;
    public readonly jobId: number;
    public readonly artifacts: any;

    public readonly afterScripts: string[] = [];
    public readonly beforeScripts: string[] = [];
    public readonly cwd: any;
    public readonly globals: any;
    public readonly description: string;
    public readonly scripts: string[] = [];
    public readonly variables: { [key: string]: string };
    public readonly predefinedVariables: { [key: string]: string };
    public readonly rules: any;

    public allowFailure: boolean;
    public when: string;

    private envs: { [key: string]: string };

    private prescriptsExitCode = 0;
    private afterScriptsExitCode = 0;

    private started = false;
    private finished = false;
    private running = false;
    private success = true;

    public constructor(jobData: any, name: string, stages: string[], cwd: any, globals: any, pipelineIid: number, jobId: number, maxJobNameLength: number, gitlabUser: { [key: string]: string }) {
        this.maxJobNameLength = maxJobNameLength;
        this.name = name;
        this.cwd = cwd;
        this.globals = globals;
        this.jobId = jobId;
        this.description = jobData['description'];

        // Parse extends recursively and deepExtend data.
        if (jobData.extends) {
            jobData.extends = typeof jobData.extends === "string" ? [ jobData.extends ] : jobData.extends;
            let i;
            let clonedData: any = clone(jobData);
            const maxDepth = 50;
            for (i = 0; i < maxDepth; i++) {
                const parentDatas = []
                if (!clonedData.extends) {
                    break;
                }

                for (const parentName of clonedData.extends) {
                    const parentData = globals[parentName];
                    if (!parentData) {
                        process.stderr.write(`${c.blueBright(parentName)} is used by ${c.blueBright(name)}, but is unspecified\n`)
                        process.exit(1);
                    }
                    parentDatas.push(clone(globals[parentName]));
                }

                delete clonedData.extends;
                clonedData = deepExtend.apply(this, parentDatas.concat(clonedData));
            }
            if (i === maxDepth) {
                process.stderr.write(`You seem to have an infinite extends loop starting from ${c.blueBright(name)}\n`)
                process.exit(1);
            }

            jobData = clonedData;
        }

        // If the stage name is not set, it should default to "test", see:
        // https://docs.gitlab.com/ee/ci/yaml/#configuration-parameters
        this.stage = jobData.stage || "test";
        this.stageIndex = stages.indexOf(this.stage);

        const ciDefault = globals.default || {};
        this.when = jobData.when || "on_success";
        this.scripts = [].concat(jobData.script || []);
        this.beforeScripts = [].concat(jobData.before_script || ciDefault.before_script || globals.before_script || []);
        this.afterScripts = [].concat(jobData.after_script || ciDefault.after_script || globals.after_script || []);
        this.image = jobData.image || ciDefault.image || globals.image || null;
        this.artifacts = jobData.artifacts || ciDefault.artifacts || globals.artifacts || null;
        this.allowFailure = jobData.allow_failure || false;
        this.variables = jobData.variables || {};
        this.needs = jobData.needs || null;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? { name: jobData.environment} : jobData.environment;

        if (this.scripts.length === 0) {
            process.stderr.write(`${this.getJobNameString()} ${c.red("must have script specified")}\n`);
            process.exit(1);
        }

        this.predefinedVariables = {
            GITLAB_USER_LOGIN: gitlabUser["GITLAB_USER_LOGIN"] || "local",
            GITLAB_USER_EMAIL: gitlabUser["GITLAB_USER_EMAIL"] || "local@gitlab.com",
            GITLAB_USER_NAME: gitlabUser["GITLAB_USER_NAME"] || "Bob Local",
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
    }

    public async init() {
        return Promise.all([
            this.initEnvironment(),
            this.initRules(),
        ]);
    }

    private async initEnvironment() {
        const envFile = `${this.cwd}/.gitlab-ci-local/envs/.env-${this.name}`;
        await fs.ensureFile(envFile);
        await fs.truncate(envFile);

        // Print env vars, that should be envsubst'ed
        for (const [key, value] of Object.entries({...this.globals.variables || {}, ...this.variables})) {
            await fs.appendFile(envFile, `${key}=${value}\n`);
        }

        // Pipe envs through envsubst
        await exec(`cat ${envFile} | envsubst > ${envFile}-tmp`, { env: {...this.globals.variables || {}, ...this.variables, ...process.env, ...this.predefinedVariables} });
        await exec(`mv ${envFile}-tmp ${envFile}`);

        // Print env var, that should not be envsubst'ed
        for (const [key, value] of Object.entries({...process.env, ...this.predefinedVariables})) {
            await fs.appendFile(envFile, `${key}=${JSON.stringify(value).substr(1).slice(0, -1)}\n`);
        }

        let e;
        const envFileCnt = await fs.readFile(envFile, 'utf8');
        const regExp = /(?<key>.*)=(?<value>.*)/g

        this.envs = {};
        while (e = regExp.exec(envFileCnt)) {
            this.envs[e[1]] = e[2];
        }
    }

    private async initRules() {
        if (!this.rules) {
            return;
        }

        this.when = 'never';
        this.allowFailure = false;

        for (const rule of this.rules) {
            try {
                if (rule['if']) {
                    const output = childProcess.execSync(`if [ ${rule['if']} ]; then exit 0; else exit 1; fi`, {cwd: this.cwd, env: this.envs, shell: 'bash'});
                    if (output.length > 0) {
                        process.stderr.write(`Rule output ${output}`);
                    }
                }
                this.when = rule['when'] ? rule['when'] : 'on_success';
                this.allowFailure = rule['allow_failure'] ? rule['allow_failure'] : this.allowFailure;
                break;
            } catch (e) {
                // By pass rule on exit 1
            }
        }
    }

    private getContainerName() {
        return `gitlab-ci-local-job-${this.name.replace(/[^a-zA-Z0-9_.-]/g, '-')}`
    }

    private async pullImage() {
        if (!this.image) return;

        try {
            const imagePlusTag = this.image.includes(':') ? this.image : `${this.image}:latest`;
            return await exec(`docker image ls --format '{{.Repository}}:{{.Tag}}' | grep '${imagePlusTag}'`, {env: this.envs});
        } catch (e) {
            process.stdout.write(`${this.getJobNameString()} ${c.cyanBright(`pulling ${this.image}`)}\n`)
            return await exec(`docker pull ${this.image}`, {env: this.envs});
        }
    }

    private async removeContainer() {
        if (!this.image) return;
        await exec(`docker rm -f ${this.getContainerName()}`, {env: this.envs});
    }

    private async copyArtifactsToHost() {
        if (!this.artifacts || !this.image) {
            return;
        }

        const containerName = this.getContainerName();
        const command = `echo '${JSON.stringify(this.artifacts)}' | envsubst`;
        const res = await exec(command, { env: this.envs });
        const artifacts = JSON.parse(`${res.stdout}`);

        for (const artifactPath of artifacts.paths || []) {
            const source = `${containerName}:${artifactPath}`
            const target = `${this.cwd}/${path.dirname(artifactPath)}`;
            await fs.promises.mkdir(target, { recursive: true });
            await exec(`docker cp ${source} ${target}`);
        }
    };

    public async start(): Promise<void> {
        const startTime = process.hrtime();

        this.running = true;
        this.started = true;

        await fs.ensureFile(this.getOutputFilesPath());
        await fs.truncate(this.getOutputFilesPath());
        process.stdout.write(`${this.getStartingString()} ${this.image ? c.magentaBright("in docker...") : c.magentaBright("in shell...")}\n`);

        await this.pullImage();

        const prescripts = this.beforeScripts.concat(this.scripts);
        this.prescriptsExitCode = await this.execScripts(prescripts);
        if (this.afterScripts.length === 0 && this.prescriptsExitCode > 0 && !this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this.prescriptsExitCode, false)}\n`);
            this.running = false;
            this.finished = true;
            this.success = false;
            await this.removeContainer();
            return;
        }

        if (this.afterScripts.length === 0 && this.prescriptsExitCode > 0 && this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this.prescriptsExitCode, true)}\n`);
            this.running = false;
            this.finished = true;
            await this.removeContainer();
            return;
        }

        if (this.prescriptsExitCode > 0 && this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this.prescriptsExitCode, true)}\n`);
        }

        if (this.prescriptsExitCode > 0 && !this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this.prescriptsExitCode, false)}\n`);
        }

        this.afterScriptsExitCode = 0;
        if (this.afterScripts.length > 0) {
            this.afterScriptsExitCode = await this.execScripts(this.afterScripts);
        }

        if (this.afterScriptsExitCode > 0) {
            process.stderr.write(`${this.getExitedString(startTime, this.afterScriptsExitCode, true, " (after_script)")}\n`);
        }

        if (this.prescriptsExitCode > 0 && !this.allowFailure) {
            this.success = false;
        }

        await this.copyArtifactsToHost();
        await this.removeContainer();

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

        await fs.appendFile(scriptPath, `#!/bin/sh\n`);
        await fs.appendFile(scriptPath, `set -e\n\n`);

        for (const line of scripts) {
            // Print command echo'ed in color
            const split = line.split(/\r?\n/);
            const multilineText = split.length > 1 ? ' # collapsed multi-line command' : '';
            const text = split[0].replace(/["]/g, `\\"`).replace(/[$]/g, `\\$`);
            await fs.appendFile(scriptPath, `echo "${c.green(`\$ ${text}${multilineText}`)}"\n`);

            // Print command to execute
            await fs.appendFile(scriptPath, `${line}\n`);
        }

        if (this.image) {
            const envFile = `${this.cwd}/.gitlab-ci-local/envs/.env-${this.name}`
            await this.removeContainer();
            await exec(`docker create --env-file ${envFile} --name ${this.getContainerName()} ${this.image} gitlab-ci-local-${this.name}`);
            await exec(`docker cp ${scriptPath} ${this.getContainerName()}:/usr/bin/gitlab-ci-local-${this.name}`);
            await exec(`docker cp ${this.cwd}/ ${this.getContainerName()}:`);
            return await this.executeCommandHandleOutputStreams(`docker start --attach ${this.getContainerName()}`);
        }
        return await this.executeCommandHandleOutputStreams(scriptPath);
    }

    private async executeCommandHandleOutputStreams(command: string): Promise<number> {
        const jobNameStr = this.getJobNameString();
        const outputFilesPath = this.getOutputFilesPath();
        const outFunc = (e: any, stream: NodeJS.WriteStream, colorize: (str: string) => string) => {
            for (const line of `${e}`.split(/\r?\n/)) {
                if (line.length === 0) continue;
                stream.write(`${jobNameStr} `);
                if (!line.startsWith('\u001b[32m$')) {
                    stream.write(`${colorize(">")} `);
                }
                stream.write(`${line}\n`);
                fs.appendFileSync(outputFilesPath, `${line}\n`);
            }
        }

        return new Promise((resolve, reject) => {
            const p = childProcess.exec(`${command}`, { env: this.envs, cwd: this.cwd });

            // @ts-ignore
            p.stdout.on("data", (e) => outFunc(e, process.stdout, (s) => c.greenBright(s)));
            // @ts-ignore
            p.stderr.on("data", (e) => outFunc(e, process.stderr, (s) => c.redBright(s)));

            p.on("error", (err) => reject(err));
            p.on("close", (signal) => resolve(signal));
        });
    }

    private getExitedString(startTime: [number, number], code: number, warning: boolean = false, prependString: string = "") {
        const finishedStr = this.getFinishedString(startTime);
        if (warning) {
            return `${finishedStr} ${c.yellowBright(`warning with code ${code}`)} ${prependString}`;
        }

        return `${finishedStr} ${c.red(`exited with code ${code}`)} ${prependString}`;
    }

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        const jobNameStr = this.getJobNameString();

        return `${jobNameStr} ${c.magentaBright("finished")} in ${c.magenta(`${timeStr}`)}`;
    }

    private getStartingString() {
        const jobNameStr = this.getJobNameString();

        return `${jobNameStr} ${c.magentaBright("starting")}`;
    }

    public getPrescriptsExitCode() {
        return this.prescriptsExitCode;
    }

    public getAfterPrescriptsExitCode() {
        return this.afterScriptsExitCode;
    }

    public getJobNameString() {
        return `${c.blueBright(`${this.name.padEnd(this.maxJobNameLength)}`)}`;
    }

    public getDescription() {
        return this.description || "";
    }

    public getOutputFilesPath() {
        return `${this.cwd}/.gitlab-ci-local/output/${this.name}.log`;
    }

    public getEnvs() {
        return this.envs;
    }

    public isFinished() {
        return this.finished;
    }

    public isStarted() {
        return this.started;
    }

    public isManual() {
        return this.when === "manual";
    }

    public isNever() {
        return this.when === "never";
    }

    public isRunning() {
        return this.running;
    }

    public isSuccess() {
        return this.success;
    }

    public setFinished(finished: boolean) {
        this.finished = finished;
    }

    public toString() {
        return this.name;
    }
}
