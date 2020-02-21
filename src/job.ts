import * as c from "ansi-colors";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as path from "path";
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
    public readonly stage: string;

    private readonly afterScripts: string[] = [];
    private readonly allowFailure: boolean;
    private readonly beforeScripts: string[] = [];
    private readonly cwd: any;
    private readonly globals: any;
    private readonly maxJobNameLength: number;
    private running = false;
    private readonly scripts: string[] = [];
    private readonly variables: { [key: string]: string };
    private readonly when: string;

    public constructor(jobData: any, name: string, cwd: any, globals: any, maxJobNameLength: number) {
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

        const ciDefault = globals.default || {};
        this.when = jobData.when || "on_success";
        this.beforeScripts = [].concat(jobData.before_script || ciDefault.before_script || globals.before_script || []);
        this.afterScripts = [].concat(jobData.after_script || ciDefault.after_script || globals.after_script || []);
        this.allowFailure = jobData.allow_failure || false;
        this.variables = jobData.variables || {};
    }

    public getJobNameString() {
        return `${c.blueBright(`${this.name.padEnd(this.maxJobNameLength + 1)}`)}`;
    }

    public getOutputFilesPath() {
        return `${this.cwd}/.gitlab-ci-local/output/${this.getEnvs().CI_PIPELINE_ID}/${this.name}.log`;
    }

    public isManual(): boolean {
        return this.when === "manual";
    }

    public isNever(): boolean {
        return this.when === "never";
    }

    public async start(): Promise<void> {
        const jobNameStr = this.getJobNameString();

        this.running = true;

        if (this.scripts.length === 0) {
            console.error(`${jobNameStr} ${c.red("must have script specified")}`);
            process.exit(1);
        }

        const startTime = process.hrtime();
        const prescripts = this.beforeScripts.concat(this.scripts);
        const prescriptsExitCode = await this.exec(prescripts.join(" && "));

        if (this.afterScripts.length === 0 && prescriptsExitCode > 0 && !this.allowFailure) {
            throw this.getExitedString(prescriptsExitCode, false);
        }

        if (this.afterScripts.length === 0 && prescriptsExitCode > 0 && this.allowFailure) {
            console.error(this.getExitedString(prescriptsExitCode, true));
            console.log(this.getFinishedString(startTime));
            this.running = false;

            return;
        }

        if (prescriptsExitCode > 0 && this.allowFailure) {
            console.error(this.getExitedString(prescriptsExitCode, true));
        }

        if (prescriptsExitCode > 0 && !this.allowFailure) {
            console.error(this.getExitedString(prescriptsExitCode, false));
        }

        let afterScriptsCode = 0;
        if (this.afterScripts.length > 0) {
            afterScriptsCode = await this.exec(this.afterScripts.join(" && "));
        }

        if (afterScriptsCode > 0) {
            console.error(this.getExitedString(prescriptsExitCode, true, " (after_script)"));
        }

        if (prescriptsExitCode > 0 && !this.allowFailure) {
            throw "";
        }

        console.log(this.getFinishedString(startTime));
        this.running = false;

        return;
    }

    public toString() {
        return this.name;
    }

    private async exec(script: string): Promise<number> {
        fs.ensureFileSync(this.getOutputFilesPath());
        fs.truncateSync(this.getOutputFilesPath());

        return new Promise<any>((resolve, reject) => {
            const jobNameStr = this.getJobNameString();
            const outputFilesPath = this.getOutputFilesPath();
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
                    fs.appendFileSync(outputFilesPath, `${buf}`);
                });
            }
            if (child.stderr) {
                child.stderr.on("data", (buf) => {
                    fs.appendFileSync(outputFilesPath, `${c.red(`${buf}`)}`);
                });
            }

            child.on("exit", resolve);
        });
    }

    private getEnvs(): { [key: string]: string } {
        return {...this.globals.variables || {}, ...this.variables, ...process.env};
    }

    private getExitedString(code: number, warning: boolean = false, prependString: string = "") {
        const seeLogStr = `See ${path.resolve(this.getOutputFilesPath())}`;
        const jobNameStr = this.getJobNameString();
        if (warning) {
            return `${jobNameStr} ${c.yellowBright(`warning with code ${code}`)} ${prependString} ${seeLogStr}`;
        }

        return `${jobNameStr} ${c.red(`exited with code ${code}`)} ${prependString} ${seeLogStr}`;
    }

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        const jobNameStr = this.getJobNameString();

        return `${jobNameStr} ${c.magentaBright("finished")} in ${c.magenta(`${timeStr}`)}`;
    }
}
