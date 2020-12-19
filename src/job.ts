import * as c from "ansi-colors";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import * as deepExtend from "deep-extend";
import * as clone from "clone";
import * as prettyHrtime from "pretty-hrtime";
import * as util from "util";

const exec = util.promisify(childProcess.exec);

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

    private static escape (key: any, val: any) {
        if (typeof(val) !== "string") return val;
        return val
            .replace(/[\\]/g, '\\\\')
            .replace(/[\/]/g, '\\/')
            .replace(/[\b]/g, '\\b')
            .replace(/[\f]/g, '\\f')
            .replace(/[\n]/g, '\\n')
            .replace(/[\r]/g, '\\r')
            .replace(/[\t]/g, '\\t')
            .replace(/["]/g, '\\"')
            .replace(/\\'/g, "\\'");
    }

    public async init() {
        const command = `echo '${JSON.stringify({...this.globals.variables || {}, ...this.variables}, Job.escape)}' | envsubst`;
        const res = await exec(command, { env: {...this.globals.variables || {}, ...this.variables, ...process.env, ...this.predefinedVariables} });
        this.envs = {...JSON.parse(res.stdout), ...process.env, ...this.predefinedVariables};

        if (!this.rules) {
            return;
        }

        this.when = 'never';
        this.allowFailure = false;

        for (const rule of this.rules) {
            try {
                if (rule['if']) {
                    const output = childProcess.execSync(`if [ ${rule['if']} ]; then exit 0; else exit 1; fi`, {cwd: this.cwd, env: this.getEnvs(), shell: 'bash'});
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
        this.prescriptsExitCode = await this.execScripts(prescripts);
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
            this.afterScriptsExitCode = await this.execScripts(this.afterScripts);
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

    private async execScripts(scripts: string[]): Promise<number> {
        if (scripts.length === 0) {
            return Promise.reject(new Error(`'scripts:' empty for ${this.name}`));
        }

        const jobName = this.name;
        const jobNameStr = this.getJobNameString();
        const outputFilesPath = this.getOutputFilesPath();
        const scriptPath = `${this.cwd}/.gitlab-ci-local/shell/${jobName}.sh`;

        await fs.ensureFile(scriptPath);
        await fs.chmod(scriptPath, '755');
        await fs.truncate(scriptPath);


        await fs.appendFile(scriptPath, `#!/bin/bash\n`);
        await fs.appendFile(scriptPath, `set -e\n`);

        for (const line of scripts) {
            await fs.appendFile(scriptPath, `echo '${c.green(`\$ ${line.replace(/[']/g, "\\''")}`)}'\n`);
            await fs.appendFile(scriptPath, `${line}\n`);
        }

        return new Promise((resolve, reject) => {
            const p = childProcess.exec(`${scriptPath}`, { env: this.envs, cwd: this.cwd, shell: 'bash' });

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

            // @ts-ignore
            p.stdout.on("data", (e) => outFunc(e, process.stdout, (s) => c.greenBright(s)));
            // @ts-ignore
            p.stderr.on("data", (e) => outFunc(e, process.stderr, (s) => c.redBright(s)));

            p.on("error", (err) => reject(err));
            p.on("close", (signal) => resolve(signal));
        });
    }

    private getEnvs(): { [key: string]: string } {
        return this.envs;
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
