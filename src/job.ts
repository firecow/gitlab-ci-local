import c = require("ansi-colors");
import * as dotProp from "dot-prop";
import prettyHrtime = require("pretty-hrtime");
import * as shelljs from "shelljs";
import {IKeyValue} from "./index";

const shell = process.env.EXEPATH ? `${process.env.EXEPATH}/bash.exe` : "/bin/bash";

export class Job {

    private static getScriptLikeFromData(jobData: any, keyname: string): string[] {
        const sc = dotProp.get<string | string[] | undefined>(jobData, keyname);
        if (sc) {
            let scripts: string[] = [];
            scripts = scripts.concat(sc);
            return scripts;
        }
        return [];
    }

    public readonly stage: string;
    public readonly name: string;

    private readonly cwd: any;

    private readonly globalVariables: IKeyValue;
    private readonly variables: IKeyValue;
    private variablesLocal: IKeyValue = {};

    private allowFailure: boolean;
    private beforeScripts: string[] = [];
    private afterScripts: string[] = [];
    private scripts: string[] = [];

    constructor(jobData: any, name: string, cwd: any, globalVariables: IKeyValue) {
        this.name = name;
        this.cwd = cwd;
        this.globalVariables = globalVariables;
        this.stage = dotProp.get<string>(jobData, "stage") || ".pre";

        this.scripts = Job.getScriptLikeFromData(jobData, "script");
        this.beforeScripts = Job.getScriptLikeFromData(jobData, "before_script");
        this.afterScripts = Job.getScriptLikeFromData(jobData, "after_script");

        this.allowFailure = dotProp.get<boolean>(jobData, "allow_failure") || false;
        this.variables = dotProp.get<IKeyValue>(jobData, "variables") || {};
    }

    public override(jobData: any): void {
        const scripts = Job.getScriptLikeFromData(jobData, "script");
        this.scripts = scripts.length > 0 ? scripts : this.scripts;

        const beforeScripts = Job.getScriptLikeFromData(jobData, "before_script");
        this.beforeScripts = beforeScripts.length > 0 ? beforeScripts : this.beforeScripts;

        const afterScripts = Job.getScriptLikeFromData(jobData, "before_script");
        this.afterScripts = afterScripts.length > 0 ? afterScripts : this.afterScripts;

        this.allowFailure = dotProp.get<boolean>(jobData, "allow_failure") || this.allowFailure;
        this.variablesLocal = dotProp.get<IKeyValue>(jobData, "variables") || {};
    }

    public async start(): Promise<void> {
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
        return;
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

    public toString() {
        return this.name;
    }

    private getEnvs(): IKeyValue {
        return {...this.globalVariables, ...this.variables, ...this.variablesLocal, ...process.env};
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
                        if (l) { process.stdout.write(`${c.blueBright(`${this.name}`)} ${c.greenBright(`>`)} ${c.green(`${l}`)}\n`); }
                    });
                });
            }

            if (child.stderr) {
                child.stderr.on("data", (buf) => {
                    const lines = `${buf}`.split(/\r?\n/);
                    lines.forEach((l) => {
                        if (l) { process.stderr.write(`${c.blueBright(`${this.name}`)} ${c.redBright(`>`)} ${c.red(`${l}`)}\n`); }
                    });
                });
            }

            child.on("exit", resolve);
        });
    }
}
