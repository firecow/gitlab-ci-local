import assert from "assert";
import fs from "fs-extra";
import * as dotenv from "dotenv";
import * as path from "path";
import camelCase from "camelcase";
import {Utils} from "./utils.js";
import {WriteStreams} from "./write-streams.js";
import chalk from "chalk";

async function isInGitRepository () {
    try {
        await Utils.spawn(["git", "rev-parse", "--is-inside-work-tree"]);
        return true;
    } catch {
        return false;
    }
}

async function gitRootPath () {
    const {stdout} = await Utils.spawn(["git", "rev-parse", "--show-toplevel"]);
    return stdout;
}

export class Argv {
    static readonly default = {
        "variablesFile": ".gitlab-ci-local-variables.yml",
        "evaluateRuleChanges": true,
        "ignoreSchemaPaths": [],
        "ignorePredefinedVars": "",
    };

    map: Map<string, any> = new Map<string, any>();
    private readonly writeStreams: WriteStreams | undefined;

    private async fallbackCwd (args: any) {
        if (args.cwd !== undefined || args.file !== undefined) return;
        if (fs.existsSync(`${process.cwd()}/.gitlab-ci.yml`)) return;
        if (!(await isInGitRepository())) return;

        this.writeStreams?.stderr(chalk`{yellow .gitlab-ci.yml not found in cwd, falling back to git root directory}\n`);
        this.map.set("cwd", path.relative(process.cwd(), await gitRootPath()));
    }

    static async build (args: any, writeStreams?: WriteStreams) {
        const argv = new Argv(args, writeStreams);
        await argv.fallbackCwd(args);

        argv.injectDotenv(`${argv.home}/.gitlab-ci-local/.env`, args);
        argv.injectDotenv(`${argv.cwd}/.gitlab-ci-local-env`, args);

        if (!argv.shellExecutorNoImage && argv.shellIsolation) {
            writeStreams?.stderr(chalk`{black.bgYellowBright  WARN } --shell-isolation does not work with --no-shell-executor-no-image\n`);
        }

        if (argv.defaultImageExplicitlySet && argv.shellIsolation) {
            writeStreams?.stderr(chalk`{black.bgYellowBright  WARN } --default-image does not work with --shell-isolation=true\n`);
        }

        if (argv.defaultImageExplicitlySet && argv.shellExecutorNoImage) {
            writeStreams?.stderr(chalk`{black.bgYellowBright  WARN } --default-image does not work with --shell-executor-no-image=true\n`);
        }

        if (argv.defaultImageExplicitlySet && argv.forceShellExecutor) {
            writeStreams?.stderr(chalk`{black.bgYellowBright  WARN } --default-image does not work with --force-shell-executor=true\n`);
        }

        return argv;
    }

    private constructor (argv: any, writeStreams?: WriteStreams) {
        if (argv.noColor) {
            chalk.level = 0;
        }
        this.writeStreams = writeStreams;
        for (const [key, value] of Object.entries(argv)) {
            this.map.set(key, value);
        }
    }

    private injectDotenv (potentialDotenvFilepath: string, argv: any) {
        if (fs.existsSync(potentialDotenvFilepath)) {
            const config = dotenv.parse(fs.readFileSync(potentialDotenvFilepath));
            for (const [key, value] of Object.entries(config)) {
                const argKey = camelCase(key);

                // Special handle KEY=VALUE variable keys
                if (argKey === "variable") {
                    let currentVal = argv[argKey];
                    if (currentVal == null) {
                        currentVal = [];
                        this.map.set(argKey, currentVal);
                    }
                    if (!Array.isArray(currentVal)) {
                        continue;
                    }
                    for (const pair of value.split(" ")) {
                        currentVal.unshift(pair);
                    }
                } else if (argv[argKey] == null) {
                    // Work around `dotenv.parse` limitation https://github.com/motdotla/dotenv/issues/51#issuecomment-552559070
                    if (value === "true") this.map.set(argKey, true);
                    else if (value === "false") this.map.set(argKey, false);
                    else if (value === "null") this.map.set(argKey, null);
                    else if (!isNaN(Number(value))) this.map.set(argKey, Number(value));
                    else this.map.set(argKey, value);
                }
            }
        }
    }

    get cwd (): string {
        let cwd = this.map.get("cwd") ?? ".";
        assert(typeof cwd != "object", "--cwd option cannot be an array");
        assert(!path.isAbsolute(cwd), "Please use relative path for the --cwd option");
        cwd = path.normalize(`${process.cwd()}/${cwd}`);
        cwd = cwd.replace(/\/$/, "");
        assert(fs.pathExistsSync(cwd), `${cwd} is not a directory`);
        return cwd;
    }

    get variablesFile (): string {
        return this.map.get("variablesFile") ?? Argv.default.variablesFile;
    }

    get evaluateRuleChanges (): boolean {
        return this.map.get("evaluateRuleChanges") ?? Argv.default.evaluateRuleChanges;
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

    get network (): string[] {
        const val = this.map.get("network") ?? [];
        return typeof val == "string" ? val.split(" ") : val;
    }

    get extraHost (): string[] {
        const val = this.map.get("extraHost") ?? [];
        return typeof val == "string" ? val.split(" ") : val;
    }

    get ignoreSchemaPaths (): string[] {
        return this.map.get("ignoreSchemaPaths") ?? Argv.default.ignoreSchemaPaths;
    }

    get ignorePredefinedVars (): string[] {
        return this.map.get("ignorePredefinedVars") ?? Argv.default.ignorePredefinedVars;
    }

    get pullPolicy (): string {
        return this.map.get("pullPolicy") ?? "if-not-present";
    }

    get remoteVariables (): Array<string> {
        return this.map.get("remoteVariables");
    }

    get variable (): {[key: string]: string} {
        const val = this.map.get("variable");
        const variables: {[key: string]: string} = {};
        const pairs = typeof val == "string" ? val.split(" ") : val;
        (pairs ?? []).forEach((variablePair: string) => {
            const exec = /(?<key>\w*?)(=)(?<value>(.|\n|\r)*)/.exec(variablePair);
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
        // TODO: default to false in 5.x.x
        return this.map.get("umask") ?? true;
    }

    get userns (): string | undefined {
        return this.map.get("userns");
    }

    get privileged (): boolean {
        return this.map.get("privileged") ?? false;
    }

    get device (): string[] {
        const val = this.map.get("device") ?? [];
        return typeof val == "string" ? val.split(" ") : val;
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

    get validateDependencyChain (): boolean {
        return this.map.get("validateDependencyChain") ?? false;
    }

    get shellIsolation (): boolean {
        // TODO: default to true in 5.x.x
        return this.map.get("shellIsolation") ?? false;
    }

    get fetchIncludes (): boolean {
        return this.map.get("fetchIncludes") ?? false;
    }

    get mountCache (): boolean {
        return this.map.get("mountCache") ?? false;
    }

    get artifactsToSource (): boolean {
        // TODO: default to false in 5.x.x
        return this.map.get("artifactsToSource") ?? true;
    }

    get showTimestamps (): boolean {
        return this.map.get("timestamps") ?? false;
    }

    get maxJobNamePadding (): number | null {
        return this.map.get("maxJobNamePadding") ?? null;
    }

    get containerMacAddress (): string | null {
        return this.map.get("containerMacAddress") ?? null;
    }

    get containerEmulate (): string | null {
        return this.map.get("containerEmulate") ?? null;
    }

    get concurrency (): number | null {
        const concurrency = this.map.get("concurrency");
        if (!concurrency) return null;
        return Number(concurrency);
    }

    get containerExecutable (): string {
        return this.map.get("containerExecutable") ?? "docker";
    }

    get jsonSchemaValidation (): boolean {
        return this.map.get("jsonSchemaValidation") ?? true;
    }

    get shellExecutorNoImage (): boolean {
        // TODO: default to false in 5.x.x
        return this.map.get("shellExecutorNoImage") ?? true;
    }

    get forceShellExecutor (): boolean {
        return this.map.get("forceShellExecutor") ?? false;
    }

    get defaultImage (): string {
        return this.map.get("defaultImage") ?? "docker.io/ruby:3.1";
    }

    get waitImage (): string {
        return this.map.get("waitImage") ?? "docker.io/sumina46/wait-for-it:latest";
    }

    get helperImage (): string {
        return this.map.get("helperImage") ?? "docker.io/firecow/gitlab-ci-local-util:latest";
    }

    get defaultImageExplicitlySet (): boolean {
        return this.map.get("defaultImage") ?? false;
    }

    get maximumIncludes (): number {
        return this.map.get("maximumIncludes") ?? 150; // https://docs.gitlab.com/ee/administration/settings/continuous_integration.html#maximum-includes
    }

    get childPipelineDepth (): number {
        return this.map.get("childPipelineDepth");
    }
}
