import c = require("ansi-colors");
import prettyHrtime = require("pretty-hrtime");
import * as shelljs from "shelljs";

const shell = process.env.EXEPATH ? `${process.env.EXEPATH}/bash.exe` : "/bin/bash";

export class Job {

    public readonly stage: string;
    public readonly name: string;

    private readonly cwd: any;
    private readonly globals: any;

    private readonly variables: { [key: string]: string };

    private readonly allowFailure: boolean;

    private readonly beforeScripts: string[] = [];
    private readonly scripts: string[] = [];
    private readonly afterScripts: string[] = [];

    private running: boolean = false;

    constructor(jobData: any, name: string, cwd: any, globals: any) {
        this.name = name;
        this.cwd = cwd;
        this.globals = globals;

        this.stage = jobData.stage || ".pre";
        this.scripts = [].concat(jobData.script || []);

        const ciDefault = globals.default || {};
        this.beforeScripts = [].concat(jobData.before_script || ciDefault.before_script || globals.before_script || []);
        this.afterScripts = [].concat(jobData.after_script || ciDefault.after_script || globals.after_script || []);
        this.allowFailure = jobData.allow_failure || false;
        this.variables = jobData.variables || {};
    }

    public async start(): Promise<void> {
        this.running = true;

        if (this.scripts.length === 0) {
            console.error(`${c.blueBright(`${this.name}`)} ${c.red(`must have script specified`)}`);
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

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        return `${c.blueBright(`${this.name}`)} ${c.magentaBright(`finished`)} in ${c.magenta(`${timeStr}`)}`;
    }

    private getExitedString(code: number, warning: boolean = false, prependString: string = "") {
        const mistakeStr = warning ? c.yellowBright(`warning with code ${code}`) + prependString : c.red(`exited with code ${code}`) + prependString;
        return `${c.blueBright(`${this.name}`)} ${mistakeStr}`;
    }

    private getEnvs(): { [key: string]: string } {
        return {...this.globals.variables || {}, ...this.variables, ...process.env};
    }

    private async exec(script: string): Promise<number> {
        return new Promise<any>((resolve, reject) => {
            const child = shelljs.exec(`${script}`, {
                cwd: this.cwd,
                env: this.getEnvs(),
                async: true,
                silent: true,
                shell,
            });

            child.on("error", (e) => {
                reject(`${c.blueBright(`${this.name}`)} ${c.red(`error ${e}`)}`);
            });

            if (child.stdout) {
                child.stdout.on("data", (buf) => {
                    const lines = `${buf}`.split(/\r?\n/);
                    lines.forEach((l) => {
                        if (!l) {
                            return;
                        }
                        process.stdout.write(`${c.blueBright(`${this.name}`)} ${c.greenBright(`>`)} ${c.green(`${l}`)}\n`);
                    });
                });
            }

            if (child.stderr) {
                child.stderr.on("data", (buf) => {
                    const lines = `${buf}`.split(/\r?\n/);
                    lines.forEach((l) => {
                        if (!l) {
                            return;
                        }
                        process.stderr.write(`${c.blueBright(`${this.name}`)} ${c.redBright(`>`)} ${c.red(`${l}`)}\n`);
                    });
                });
            }

            child.on("exit", resolve);
        });
    }
}
