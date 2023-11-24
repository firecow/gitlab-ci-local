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
        return this.splitArray(this.map.get("volume"));
    }

    get network (): string[] {
        return this.splitArray(this.map.get("network"));
    }

    get extraHost (): string[] {
        return this.splitArray(this.map.get("extraHost"));
    }

    get remoteVariables (): string {
        return this.map.get("remoteVariables");
    }

    get variable (): {[key: string]: string} {
        const val = this.map.get("variable") ?? [];
        const variables: {[key: string]: string} = {};
        val.forEach((v: string) => {
            const pairs = v.split(";").map(e => e.split("="));
            for (const pair of pairs) {
                variables[pair[0]] = pair[1];
            }
        });
        return variables;
    }

    get unsetVariables (): string[] {
        return this.splitArray(this.map.get("unsetVariable") ?? []);
    }

    get manual (): string[] {
        return this.splitArray(this.map.get("manual") ?? []);
    }

    get job (): string[] {
        return this.splitArray(this.map.get("job") ?? []);
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

    get ulimit (): string | null {
        const ulimit = this.map.get("ulimit");
        if (!ulimit) return null;
        return ulimit;
    }

    get needs (): boolean {
        return this.map.get("needs") ?? false;
    }

    get onlyNeeds (): boolean {
        return this.map.get("onlyNeeds") ?? false;
    }

    get stage (): string | null {
        return this.map.get("stage") ?? null;
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

    get showTimestamps (): boolean {
        return this.map.get("timestamps") ?? false;
    }

    get maxJobNamePadding (): number | null {
        return this.map.get("maxJobNamePadding") ?? null;
    }

    get concurrency (): number | null {
        const concurrency = this.map.get("concurrency");
        if (!concurrency) return null;
        return Number(concurrency);
    }

    get containerExecutable (): string {
        return this.map.get("containerExecutable") ?? "docker";
    }

    private splitArray (arr?: string[], separator = ";") {
        const res: string[] = [];
        if (!arr) return res;
        for (const v of arr) {
            res.push(...v.split(separator));
        }
        return res;
    }
}
