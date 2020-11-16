import * as c from "ansi-colors";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as deepExtend from "deep-extend";
import * as clone from "clone";
import * as prettyHrtime from "pretty-hrtime";

let shell = "/bin/bash";
if (process.env.EXEPATH) {
    const bashExes = glob.sync(`${process.env.EXEPATH}/**/bash.exe`);
    if (bashExes.length === 0) {
        process.stderr.write(`${c.red("Could not find any bash executables")}\n`);
        process.exit(1);
    }
    shell = bashExes[0];
}

export class Job {
    public readonly name: string;
    public readonly needs: string[] | null;
    public readonly stage: string;
    public readonly maxJobNameLength: number;
    public readonly stageIndex: number;
    public readonly environment: { name: string|null, url: string|null } | null;

    private readonly afterScripts: string[] = [];
    private readonly beforeScripts: string[] = [];
    private readonly cwd: any;
    private readonly globals: any;
    private readonly description: string;
    private readonly scripts: string[] = [];
    private readonly variables: { [key: string]: string };
    private readonly predefinedVariables: { [key: string]: string };
    private readonly rules: any;

    public allowFailure: boolean;
    public when: string;

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
        this.description = jobData['description'];

        // Parse extends recursively and deepExtend data.
        if (jobData.extends) {
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
        this.scripts = [].concat(jobData.script || []);

        this.stageIndex = stages.indexOf(this.stage);

        const jobNameStr = this.getJobNameString();

        if (this.scripts.length === 0) {
            process.stderr.write(`${jobNameStr} ${c.red("must have script specified")}\n`);
            process.exit(1);
        }

        const ciDefault = globals.default || {};
        this.when = jobData.when || "on_success";
        this.beforeScripts = [].concat(jobData.before_script || ciDefault.before_script || globals.before_script || []);
        this.afterScripts = [].concat(jobData.after_script || ciDefault.after_script || globals.after_script || []);
        this.allowFailure = jobData.allow_failure || false;
        this.variables = jobData.variables || {};
        this.needs = jobData.needs || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? { name: jobData.environment} : jobData.environment;

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
            CI_JOB_ID: `${jobId}`, // Changes on rerun
            CI_PIPELINE_ID: `${pipelineIid + 1000}`,
            CI_PIPELINE_IID: `${pipelineIid}`,
            CI_SERVER_URL: "https://gitlab.com",
            CI_PROJECT_URL: "https://gitlab.com/group/sub/local-project",
            CI_JOB_URL: `https://gitlab.com/group/sub/local-project/-/jobs/${jobId}`, // Changes on rerun.
            CI_PIPELINE_URL: `https://gitlab.cego.dk/group/sub/local-project/pipelines/${pipelineIid}`,
            CI_JOB_NAME: `${this.name}`,
            CI_JOB_STAGE: `${this.stage}`,
            GITLAB_CI: "false",
        };
    }

    public async initRules() {
        if (!this.rules) {
            return;
        }

        this.when = 'never';
        this.allowFailure = false;

        for (const rule of this.rules) {
            try {
                if (rule['if']) {
                    const output = childProcess.execSync(`[ ${rule['if']} ] && exit 0 || exit 1`, {cwd: this.cwd, env: this.getEnvs(), shell: 'bash'});
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

    public async start(): Promise<void> {
        fs.ensureFileSync(this.getOutputFilesPath());
        fs.truncateSync(this.getOutputFilesPath());
        process.stdout.write(`${this.getStartingString()}\n`);
        this.running = true;

        const startTime = process.hrtime();
        const prescripts = this.beforeScripts.concat(this.scripts);
        this.prescriptsExitCode = await this.exec(prescripts);
        this.started = true;
        if (this.afterScripts.length === 0 && this.prescriptsExitCode > 0 && !this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this.prescriptsExitCode, false)}\n`);
            this.running = false;
            this.finished = true;
            this.success = false;

            return;
        }

        if (this.afterScripts.length === 0 && this.prescriptsExitCode > 0 && this.allowFailure) {
            process.stderr.write(`${this.getExitedString(startTime, this.prescriptsExitCode, true)}\n`);
            this.running = false;
            this.finished = true;

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
            this.afterScriptsExitCode = await this.exec(this.afterScripts);
        }

        if (this.afterScriptsExitCode > 0) {
            process.stderr.write(`${this.getExitedString(startTime, this.afterScriptsExitCode, true, " (after_script)")}\n`);
        }

        if (this.prescriptsExitCode > 0 && !this.allowFailure) {
            this.success = false;
        }

        process.stdout.write(`${this.getFinishedString(startTime)}\n`);

        this.running = false;
        this.finished = true;

        return;
    }

    public toString() {
        return this.name;
    }

    private async exec(scripts: string[]): Promise<number> {
        if (scripts.length === 0) {
            return Promise.resolve(0);
        }

        const jobNameStr = this.getJobNameString();
        const outputFilesPath = this.getOutputFilesPath();

        return new Promise((resolve, reject) => {
            const bash = childProcess.spawn("bash", {cwd: this.cwd, env: this.getEnvs()});
            bash.on("error", (err) => {
                reject(err);
            });
            bash.on("close", (signal) => {
                resolve(signal);
            });

            const nextCmd = () => {
                const script = scripts.shift();
                if (!script) {
                    bash.stdin.write("exit 0\n");
                } else {
                    process.stdout.write(`${jobNameStr} ${c.green(`\$ ${script}`)}\n`);
                    bash.stdin.write(`${script};echo GCL_MARKER=$?\n`);
                }
            };

            bash.stdout.on("data", (e) => {
                const out = `${e}`;
                const exec = /GCL_MARKER=(?<exitCode>\d*)/.exec(out);
                const stripped = out.replace(/GCL_MARKER=\d*\n/, "");

                if (stripped !== "") {
                    for (const line of stripped.split(/\r?\n/)) {
                        if (line !== "") {
                            fs.appendFileSync(outputFilesPath, `${line}\n`);
                            process.stdout.write(`${jobNameStr} ${c.greenBright(">")} ${line}\n`);
                        }
                    }
                }

                if (exec && exec.groups && exec.groups.exitCode && exec.groups.exitCode === "0") {
                    nextCmd();
                } else if (exec && exec.groups && exec.groups.exitCode && exec.groups.exitCode !== "0") {
                    bash.stdin.write(`exit ${exec.groups.exitCode}\n`);
                } else if (exec) {
                    reject(`GCL_MARKER was not parsed correctly ${JSON.stringify(exec)}`);
                }
            });
            bash.stderr.on("data", (e) => {
                const err = `${e}`;
                if (err !== "") {
                    for (const line of err.split(/\r?\n/)) {
                        if (line !== "") {
                            fs.appendFileSync(outputFilesPath, `${line}\n`);
                            process.stderr.write(`${jobNameStr} ${c.redBright(">")} ${line}\n`);
                        }
                    }
                }
            });

            nextCmd();
        });
    }

    private getEnvs(): { [key: string]: string } {
        const envs: { [key: string]: string } = {...this.globals.variables || {}, ...this.variables, ...process.env, ...this.predefinedVariables};
        const regex = /\${(.*?)}/g;
        let exec;

        for (const [env, value] of Object.entries(envs)) {
            while ((exec = regex.exec(value as string)) !== null) {
                const cap = exec[1];
                if (this.predefinedVariables[cap] != null) {
                    const replacer = new RegExp(`\\$\{${cap}\}`, "g");
                    envs[env] = value.replace(replacer, this.predefinedVariables[cap]);
                }
            }
        }

        return envs;
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

        return `${jobNameStr} ${c.magentaBright("starting")}...`;
    }
}
