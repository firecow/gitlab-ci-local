import assert from "assert";
import * as fs from "fs-extra";
import * as dotenv from "dotenv";
import * as path from "path";
import camelCase from "camelcase";

export class Argv {

    private map: Map<string, any> = new Map<string, any>();

    constructor (argv: any) {
        for (const [key, value] of Object.entries(argv)) {
            this.map.set(key, value);
        }

        this.injectDotenv(`${this.home}/.gitlab-ci-local/.env`, argv);
        this.injectDotenv(`${this.cwd}/.gitlab-ci-local-env`, argv);
    }

    private injectDotenv (potentialDotenvFilepath: string, argv: any) {
        if (fs.existsSync(potentialDotenvFilepath)) {
            const config = dotenv.parse(fs.readFileSync(potentialDotenvFilepath));
            for (const [key, value] of Object.entries(config)) {
                const argKey = camelCase(key);
                if (argv[argKey] == null) {
                    this.map.set(argKey, value);
                }
            }
        }
    }

    get cwd (): string {
        let cwd = this.map.get("cwd") ?? ".";
        assert(typeof cwd != "object", "--cwd option cannot be an array");
        cwd = path.normalize(`${process.cwd()}/${cwd}`);
        cwd = cwd.replace(/\/$/, "");
        assert(fs.pathExistsSync(cwd), `${cwd} is not a directory`);
        return cwd;
    }

    get file (): string {
        return this.map.get("file") ?? ".gitlab-ci.yml";
    }

    get stateDir (): string {
        return (this.map.get("stateDir") ?? ".gitlab-ci-local").replace(/\/$/, "");
    }

    get home (): string {
        return (this.map.get("home") ?? process.env.HOME ?? "").replace(/\/$/, "");
    }

    get volume (): string[] {
        const val = this.map.get("volume") ?? [];
        return typeof val == "string" ? val.split(" ") : val;
    }

    get extraHost (): string[] {
        const val = this.map.get("extraHost") ?? [];
        return typeof val == "string" ? val.split(" ") : val;
    }

    get remoteVariables (): string {
        return this.map.get("remoteVariables");
    }

    get variable (): {[key: string]: string} {
        const val = this.map.get("variable");
        const variables: {[key: string]: string} = {};
        const pairs = typeof val == "string" ? val.split(" ") : val;
        (pairs ?? []).forEach((variablePair: string) => {
            const exec = /(?<key>\w*?)(=)(?<value>.*)/.exec(variablePair);
            if (exec?.groups?.key) {
                variables[exec.groups.key] = exec?.groups?.value;
            }
        });
        return variables;
    }

    get unsetVariables (): string[] {
        return this.map.get("unsetVariable") ?? [];
    }

    get manual (): string[] {
        const val = this.map.get("manual") ?? [];
        return typeof val == "string" ? val.split(" ") : val;
    }

    get job (): string[] {
        return this.map.get("job") ?? [];
    }

    get autoCompleting (): boolean {
        return this.map.get("autoCompleting") ?? false;
    }

    get cleanup (): boolean {
        return this.map.get("cleanup") ?? true;
    }

    get quiet (): boolean {
        return this.map.get("quiet") ?? false;
    }

    get umask (): boolean {
        return this.map.get("umask") ?? true;
    }

    get privileged (): boolean {
        return this.map.get("privileged") ?? false;
    }

    get ulimit (): number {
        return this.map.get("ulimit") ?? -1;
    }

    get needs (): boolean {
        return this.map.get("needs") ?? false;
    }

    get onlyNeeds (): boolean {
        return this.map.get("onlyNeeds") ?? false;
    }

    get stage (): string | undefined {
        return this.map.get("stage");
    }

    get completion (): boolean {
        return this.map.get("completion") ?? false;
    }

    get list (): boolean {
        return this.map.get("list") ?? false;
    }

    get listAll (): boolean {
        return this.map.get("listAll") ?? false;
    }

    get listJson (): boolean {
        return this.map.get("listJson") ?? false;
    }

    get listCsv (): boolean {
        return this.map.get("listCsv") ?? false;
    }

    get listCsvAll (): boolean {
        return this.map.get("listCsvAll") ?? false;
    }

    get preview (): boolean {
        return this.map.get("preview") ?? false;
    }

    get shellIsolation (): boolean {
        return this.map.get("shellIsolation") ?? false;
    }

    get fetchIncludes (): boolean {
        return this.map.get("fetchIncludes") ?? false;
    }

    get mountCache (): boolean {
        return this.map.get("mountCache") ?? false;
    }

    get artifactsToSource (): boolean {
        return this.map.get("artifactsToSource") ?? true;
    }
}
