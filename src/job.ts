import * as c from "ansi-colors";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as prettyHrtime from "pretty-hrtime";
import * as shelljs from "shelljs";

let shell = "/bin/bash";
if (process.env.EXEPATH) {
    const bashExes = glob.sync(`${process.env.EXEPATH}/**/bash.exe`);
    if (bashExes.length === 0) {
        console.error(`${c.red("Could not find any bash executables")}`);
        process.exit(1);
    }
    shell = bashExes[0];
}

export class Job {
    public readonly name: string;
    public readonly needs: string[] | null;
    public readonly stage: string;
    public readonly allowFailure: boolean;
    public readonly when: string;
    public readonly maxJobNameLength: number;
    public readonly stageIndex: number;

    private readonly afterScripts: string[] = [];
    private readonly beforeScripts: string[] = [];
    private readonly cwd: any;
    private readonly globals: any;
    private readonly scripts: string[] = [];
    private readonly variables: { [key: string]: string };

    private prescriptsExitCode = 0;
    private afterScriptsExitCode = 0;

    private started = false;
    private finished = false;
    private running = false;
    private success = true;

    public constructor(jobData: any, name: string, stages: string[], cwd: any, globals: any, maxJobNameLength: number) {
        this.maxJobNameLength = maxJobNameLength;
        this.name = name;
        this.cwd = cwd;
        this.globals = globals;

        // Parse extends
        if (jobData.extends) {
            const extendList = [].concat(jobData.extends);
            const deepExtendList: any[] = [{}];
            extendList.forEach((parentJobName) => {
                if (!globals[parentJobName]) {
                    console.error(`${c.red(`'${parentJobName}' could not be found`)}`);
                    process.exit(1);
                }
                deepExtendList.push(globals[parentJobName]);
            });

            deepExtendList.push(jobData);
            // tslint:disable-next-line:no-parameter-reassignment
            jobData = deepExtend.apply(this, deepExtendList);
        }

        this.stage = jobData.stage || ".pre";
        this.scripts = [].concat(jobData.script || []);

        this.stageIndex = stages.indexOf(this.stage);
        if (this.stageIndex === -1) {
            console.error(`${c.red("Stage index is -1")}`);
            process.exit(1);
        }

        const jobNameStr = this.getJobNameString();

        if (this.scripts.length === 0) {
            console.error(`${jobNameStr} ${c.red("must have script specified")}`);
            process.exit(1);
        }

        const ciDefault = globals.default || {};
        this.when = jobData.when || "on_success";
        this.beforeScripts = [].concat(jobData.before_script || ciDefault.before_script || globals.before_script || []);
        this.afterScripts = [].concat(jobData.after_script || ciDefault.after_script || globals.after_script || []);
        this.allowFailure = jobData.allow_failure || false;
        this.variables = jobData.variables || {};
        this.needs = jobData.needs || null;
    }

    public getPrescriptsExitCode() {
        return this.prescriptsExitCode;
    }

    public getAfterPrescriptsExitCode() {
        return this.afterScriptsExitCode;
    }

    public getJobNameString() {
        return `${c.blueBright(`${this.name.padEnd(this.maxJobNameLength + 1)}`)}`;
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
        console.log(this.getStartingString());
        this.running = true;

        const startTime = process.hrtime();
        const prescripts = this.beforeScripts.concat(this.scripts);
        this.prescriptsExitCode = await this.exec(prescripts.join(" && "));
        this.started = true;
        if (this.afterScripts.length === 0 && this.prescriptsExitCode > 0 && !this.allowFailure) {
            console.error(this.getExitedString(startTime, this.prescriptsExitCode, false));
            this.running = false;
            this.finished = true;
            this.success = false;

            return;
        }

        if (this.afterScripts.length === 0 && this.prescriptsExitCode > 0 && this.allowFailure) {
            console.error(this.getExitedString(startTime, this.prescriptsExitCode, true));
            this.running = false;
            this.finished = true;

            return;
        }

        if (this.prescriptsExitCode > 0 && this.allowFailure) {
            console.error(this.getExitedString(startTime, this.prescriptsExitCode, true));
        }

        if (this.prescriptsExitCode > 0 && !this.allowFailure) {
            console.error(this.getExitedString(startTime, this.prescriptsExitCode, false));
        }

        this.afterScriptsExitCode = 0;
        if (this.afterScripts.length > 0) {
            this.afterScriptsExitCode = await this.exec(this.afterScripts.join(" && "));
        }

        if (this.afterScriptsExitCode > 0) {
            console.error(this.getExitedString(startTime, this.prescriptsExitCode, true, " (after_script)"));
        }

        if (this.prescriptsExitCode > 0 && !this.allowFailure) {
            this.success = false;
        }

        console.log(this.getFinishedString(startTime));

        this.running = false;
        this.finished = true;

        return;
    }

    public toString() {
        return this.name;
    }

    private async exec(script: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const jobNameStr = this.getJobNameString();
            const outputFilesPath = this.getOutputFilesPath();

            const split = script.split(" && ");
            split.forEach((s) => {
                console.log(`${jobNameStr} ${c.green(`\$ ${s}`)}`);
                fs.appendFileSync(outputFilesPath, `\$ ${s}\n`);
            });

            const child = shelljs.exec(`${script}`, {
                cwd: this.cwd,
                env: this.getEnvs(),
                async: true,
                silent: true,
                shell,
            });

            child.on("error", (e) => {
                reject(`${jobNameStr} ${c.red(`error ${String(e)}`)}`);
            });

            if (child.stdout) {
                child.stdout.on("data", (buf) => {
                    const lines = `${buf}`.split(/\r?\n/);
                    lines.forEach((l) => {
                        if (!l) {
                            return;
                        }
                        process.stdout.write(`${jobNameStr} ${c.greenBright(">")} ${l}\n`);
                    });
                    fs.appendFileSync(outputFilesPath, `${buf}`);
                });
            }
            if (child.stderr) {
                child.stderr.on("data", (buf) => {
                    const lines = `${buf}`.split(/\r?\n/);
                    lines.forEach((l) => {
                        if (!l) {
                            return;
                        }
                        process.stderr.write(`${jobNameStr} ${c.redBright(">")} ${l}\n`);
                    });
                    fs.appendFileSync(outputFilesPath, `${buf}`);
                });
            }

            child.on("exit", resolve);
        });
    }

    private getEnvs(): { [key: string]: string } {
        return {...this.globals.variables || {}, ...this.variables, ...process.env};
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
