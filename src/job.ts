import c = require("ansi-colors");
import * as dotProp from "dot-prop";
import * as shelljs from "shelljs";
import {IKeyValue} from "./index";

const shell = process.env.EXEPATH ? `${process.env.EXEPATH}/bash.exe` : "/usr/bin/bash";

export class Job {

    public readonly stage: string;
    public readonly name: string;

    private readonly cwd: any;

    private readonly globalVariables: IKeyValue;
    private readonly variables: IKeyValue;
    private variablesLocal: IKeyValue = {};

    private beforeScripts: string[] = [];
    private scripts: string[] = [];

    constructor(jobData: any, name: string, cwd: any, globalVariables: IKeyValue) {
        this.name = name;
        this.cwd = cwd;
        this.globalVariables = globalVariables;
        this.stage = dotProp.get<string>(jobData, "stage") || ".pre";

        this.scripts = this.getScriptsFromData(jobData);

        const beforeS = dotProp.get<string | string[] | undefined>(jobData, "before_script");
        const beforeSL = dotProp.get<string | string[] | undefined>(jobData, "before_script_local");
        if (beforeS) { this.beforeScripts = this.beforeScripts.concat(beforeS); }
        if (beforeSL) { this.beforeScripts = this.beforeScripts.concat(beforeSL); }

        this.variables = dotProp.get<IKeyValue>(jobData, "variables") || {};
    }

    public override(jobData: any): void {
        this.scripts = this.getScriptsFromData(jobData);
        this.variablesLocal = dotProp.get<IKeyValue>(jobData, "variables") || {};
    }

    public start(): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            const prescripts = this.beforeScripts.concat(this.scripts);
            this.exec(prescripts.join(" && "), resolve, reject);
        });
    }

    public toString() {
        return this.name;
    }

    private getEnvs(): IKeyValue {
        return {...this.globalVariables, ...this.variables, ...this.variablesLocal, ...process.env};
    }

    private getScriptsFromData(jobData: any): string[] {
        const sc = dotProp.get<string | string[] | undefined>(jobData, "script");
        if (sc) {
            let scripts: string[] = [];
            scripts = scripts.concat(sc);
            return scripts;
        } else {
            console.error(`${c.blueBright(`${this.name}`)} ${c.red(`must have script specified`)}`);
            process.exit(1);
        }
    }

    private exec(script: string, resolve: (b: boolean) => void, reject: () => void) {
        const child = shelljs.exec(`${script}`, {
            cwd: this.cwd,
            env: this.getEnvs(),
            async: true,
            silent: true,
            shell,
        });
        if (child.stdout) {
            child.stdout.on("data", (buf) => {
                process.stdout.write(`${c.blueBright(`${this.name}`)}: ${buf}`);
            });
        }
        if (child.stderr) {
            child.stderr.on("data", (buf) => {
                process.stderr.write(`${c.blueBright(`${this.name}`)}: ${c.red(`${buf}`)}`);
            });
        }

        child.on("exit", (code) => {
            if (code !== 0) {
                console.error(`Bad Exit ${c.red(`${this.name}`)} with ${code}`);
                reject();
                return;
            }
            console.log(`Finished ${c.blueBright(`${this.name}`)}`);
            resolve(true);
        });
    }
}
