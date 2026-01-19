import "./global.js";
import {RE2JS} from "re2js";
import chalk from "chalk";
import {Job, JobRule} from "./job.js";
import fs from "fs-extra";
import checksum from "checksum";
import base64url from "base64url";
import execa, {ExecaError} from "execa";
import assert from "assert";
import {CICDVariable} from "./variables-from-files.js";
import {GitData, GitSchema} from "./git-data.js";
import globby from "globby";
import micromatch from "micromatch";
import axios, {AxiosRequestConfig} from "axios";
import path from "path";
import {Argv} from "./argv.js";

type RuleResultOpt = {
    argv: Argv;
    cwd: string;
    rules: JobRule[];
    variables: {[key: string]: string};
};

type ExpandWith = {
    unescape: string;
    variable: (name: string) => string;
};

export class Utils {
    static bashMulti (scripts: string[], cwd = process.cwd()): Promise<{stdout: string; stderr: string; exitCode: number}> {
        return execa(scripts.join(" && \\"), {shell: "bash", cwd});
    }

    static bash (shellScript: string, cwd = process.cwd()): Promise<{stdout: string; stderr: string; exitCode: number}> {
        return execa(shellScript, {shell: "bash", cwd});
    }

    static spawn (cmdArgs: string[], cwd = process.cwd()): Promise<{stdout: string; stderr: string}> {
        return execa(cmdArgs[0], cmdArgs.slice(1), {cwd});
    }

    static syncSpawn (cmdArgs: string[], cwd = process.cwd()): {stdout: string; stderr: string} {
        return execa.sync(cmdArgs[0], cmdArgs.slice(1), {cwd});
    }

    static fsUrl (url: string): string {
        return url.replace(/^https:\/\//g, "").replace(/^http:\/\//g, "");
    }

    static safeDockerString (jobName: string) {
        return jobName.replace(/[^\w-]+/g, (match) => {
            return base64url.encode(match);
        });
    }

    static safeBashString (s: string) {
        return `'${s.replace(/'/g, "'\"'\"'")}'`; // replaces `'` with `'"'"'`
    }

    static forEachRealJob (gitlabData: any, callback: (jobName: string, jobData: any) => void) {
        for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
            if (Job.illegalJobNames.has(jobName) || jobName[0].startsWith(".")) {
                continue;
            }
            callback(jobName, jobData);
        }
    }

    static getJobNamesFromPreviousStages (jobs: ReadonlyArray<Job>, stages: readonly string[], currentJob: Job) {
        const jobNames: string[] = [];
        const currentStageIndex = stages.indexOf(currentJob.stage);
        jobs.forEach(job => {
            const stageIndex = stages.indexOf(job.stage);
            if (stageIndex < currentStageIndex) {
                jobNames.push(job.name);
            }
        });
        return jobNames;
    }

    static async getCoveragePercent (cwd: string, stateDir: string, coverageRegex: string, jobName: string) {
        const content = await fs.readFile(`${cwd}/${stateDir}/output/${jobName}.log`, "utf8");

        const regex = RE2JS.compile(
            coverageRegex
                .replace(/^\//, "")
                .replace(/\/$/, ""),
            RE2JS.MULTILINE,
        );
        const matches = Array.from(content.matchAllRE2JS(regex));
        if (matches.length === 0) return "0";

        const lastMatch = matches[matches.length - 1];
        const digits = /\d+(?:\.\d+)?/.exec(lastMatch[1] ?? lastMatch[0]);
        if (!digits) return "0";
        return digits[0] ?? "0";
    }

    static printJobNames (stream: (txt: string) => void, job: {name: string}, i: number, arr: {name: string}[]) {
        if (i === arr.length - 1) {
            stream(chalk`{blueBright ${job.name}}`);
        } else {
            stream(chalk`{blueBright ${job.name}}, `);
        }
    }

    private static expandTextWith (text: any, expandWith: ExpandWith) {
        if (typeof text !== "string") {
            return text;
        }

        return text.replace(
            /(\$\$)|\$\{([a-zA-Z_]\w*)}|\$([a-zA-Z_]\w*)/g, // https://regexr.com/7s4ka
            (_match, escape, var1, var2) => {
                if (typeof escape !== "undefined") {
                    return expandWith.unescape;
                } else {
                    const name = var1 || var2;
                    assert(name, "unexpected unset capture group");
                    return `${expandWith.variable(name)}`;
                }
            },
        );
    }

    static expandText (text: any, envs: {[key: string]: string}) {
        return this.expandTextWith(text, {
            unescape: "$",
            variable: (name) => envs[name] ?? "",
        });
    }

    static expandVariables (variables: {[key: string]: string}) {
        const _variables = {...variables}; // copy by value to prevent mutating the original input
        let expandedAnyVariables, i = 0;
        do {
            assert(i < 100, "Recursive variable expansion reached 100 iterations");
            expandedAnyVariables = false;
            for (const [k, v] of Object.entries(_variables)) {
                const envsWithoutSelf = {..._variables};
                delete envsWithoutSelf[k];
                // If the $$'s are converted to single $'s now, then the next
                // iteration, they might be interpreted as _variables, even
                // though they were *explicitly* escaped. To work around this,
                // leave the '$$'s as the same value, then only unescape them at
                // the very end.
                _variables[k] = Utils.expandTextWith(v, {
                    unescape: "$$",
                    variable: (name) => envsWithoutSelf[name] ?? "",
                });
                expandedAnyVariables ||= _variables[k] !== v;
            }
            i++;
        } while (expandedAnyVariables);

        return _variables;
    }

    static unscape$$Variables (variables: {[key: string]: string}) {
        for (const [k, v] of Object.entries(variables)) {
            variables[k] = Utils.expandText(v, {});
        }

        return variables;
    }

    static findEnvMatchedVariables (variables: {[name: string]: CICDVariable}, fileVariablesDir?: string, environment?: {name: string}) {
        const envMatchedVariables: {[key: string]: string} = {};
        for (const [k, v] of Object.entries(variables)) {
            for (const entry of v.environments) {
                if (environment?.name.match(entry.regexp) || entry.regexp.source === ".*") {
                    if (fileVariablesDir != null && v.type === "file" && !entry.fileSource) {
                        envMatchedVariables[k] = `${fileVariablesDir}/${k}`;
                        fs.mkdirpSync(`${fileVariablesDir}`);
                        fs.writeFileSync(`${fileVariablesDir}/${k}`, entry.content);
                    } else if (fileVariablesDir != null && v.type === "file" && entry.fileSource) {
                        envMatchedVariables[k] = `${fileVariablesDir}/${k}`;
                        fs.mkdirpSync(`${fileVariablesDir}`);
                        fs.copyFileSync(entry.fileSource, `${fileVariablesDir}/${k}`);
                    } else {
                        envMatchedVariables[k] = entry.content;
                    }
                    break;
                }
            }
        }
        return envMatchedVariables;
    }

    static getRulesResult (opt: RuleResultOpt, gitData: GitData, jobWhen: string = "on_success", jobAllowFailure: boolean | {exit_codes: number | number[]} = false): {when: string; allowFailure: boolean | {exit_codes: number | number[]}; variables?: {[name: string]: string}} {
        let when = "never";
        const {evaluateRuleChanges} = opt.argv;

        // optional manual jobs allowFailure defaults to true https://docs.gitlab.com/ee/ci/jobs/job_control.html#types-of-manual-jobs
        let allowFailure = jobWhen === "manual" ? true : jobAllowFailure;
        let ruleVariable: {[name: string]: string} | undefined;

        for (const rule of opt.rules) {
            if (!Utils.evaluateRuleIf(rule.if, opt.variables)) continue;
            if (!Utils.evaluateRuleExist(opt.cwd, rule.exists)) continue;
            if (evaluateRuleChanges && !Utils.evaluateRuleChanges(gitData.branches.default, rule.changes, opt.cwd)) continue;

            when = rule.when ? rule.when : jobWhen;
            allowFailure = rule.allow_failure ?? allowFailure;
            ruleVariable = rule.variables;

            break; // Early return, will not evaluate the remaining rules
        }

        return {when, allowFailure, variables: ruleVariable};
    }

    static evaluateRuleIf (ruleIf: string | undefined, envs: {[key: string]: string}): boolean {
        if (ruleIf === undefined) return true;
        let evalStr = ruleIf;

        const flagsToBinary = (flags: string): number => {
            let binary = 0;
            if (flags.includes("i")) {
                binary |= RE2JS.CASE_INSENSITIVE;
            }
            if (flags.includes("s")) {
                binary |= RE2JS.DOTALL;
            }
            if (flags.includes("m")) {
                binary |= RE2JS.MULTILINE;
            }
            return binary;
        };

        // Expand all variables
        evalStr = this.expandTextWith(evalStr, {
            unescape: JSON.stringify("$"),
            variable: (name) => JSON.stringify(envs[name] ?? null).replaceAll("\\\\", "\\"),
        });
        const expandedEvalStr = evalStr;

        // Scenario when RHS is a <regex>
        // https://regexr.com/85sjo
        const pattern1 = /\s*(?<operator>(?:=~)|(?:!~))\s*\/(?<rhs>.*?)\/(?<flags>[igmsuy]*)(\s|$|\))/g;
        evalStr = evalStr.replace(pattern1, (_, operator, rhs, flags, remainingTokens) => {
            let _operator;
            switch (operator) {
                case "=~":
                    _operator = "!=";
                    break;
                case "!~":
                    _operator = "==";
                    break;
                default:
                    throw operator;
            }
            const _rhs = JSON.stringify(rhs); // JSON.stringify for escaping `"`
            const containsNonEscapedSlash = /(?<!\\)\//.test(_rhs);
            const assertMsg = [
                "Error attempting to evaluate the following rules:",
                "  rules:",
                `    - if: '${expandedEvalStr}'`,
                "as rhs contains unescaped quote",
            ];
            assert(!containsNonEscapedSlash, assertMsg.join("\n"));
            const flagsBinary = flagsToBinary(flags);
            return `.matchRE2JS(RE2JS.compile(${_rhs}, ${flagsBinary})) ${_operator} null${remainingTokens}`;
        });

        // Scenario when RHS is surrounded by single/double-quotes
        // https://regexr.com/85t0g
        const pattern2 = /\s*(?<operator>=~|!~)\s*(["'])(?<rhs>(?:\\.|[^\\])*?)\2/g;
        evalStr = evalStr.replace(pattern2, (_, operator, __, rhs) => {
            let _operator;
            switch (operator) {
                case "=~":
                    _operator = "!=";
                    break;
                case "!~":
                    _operator = "==";
                    break;
                default:
                    throw operator;
            }

            const assertMsg = [
                "RHS (${rhs}) must be a regex pattern. Do not rely on this behavior!",
                "Refer to https://docs.gitlab.com/ee/ci/jobs/job_rules.html#unexpected-behavior-from-regular-expression-matching-with- for more info...",
            ];
            assert((/\/(.*)\/(\w*)/.test(rhs)), assertMsg.join("\n"));

            const regex = /\/(?<pattern>.*)\/(?<flags>[igmsuy]*)/;
            const _rhs = rhs.replace(regex, (_: string, pattern: string, flags: string) => {
                const flagsBinary = flagsToBinary(flags);
                return `RE2JS.compile("${pattern}", ${flagsBinary})`;
            });
            return `.matchRE2JS(${_rhs}) ${_operator} null`;
        });

        evalStr = evalStr.replace(/null.matchRE2JS\(.+?\)\s*!=\s*null/g, "false");
        evalStr = evalStr.replace(/null.matchRE2JS\(.+?\)\s*==\s*null/g, "true");

        evalStr = evalStr.trim();

        let res;
        try {
            (global as any).RE2JS = RE2JS; // Assign RE2JS to the global object
            res = (0, eval)(evalStr); // https://esbuild.github.io/content-types/#direct-eval
            delete (global as any).RE2JS; // Cleanup
        } catch {
            const assertMsg = [
                "Error attempting to evaluate the following rules:",
                "  rules:",
                `    - if: '${expandedEvalStr}'`,
                "as",
                "```javascript",
                `${evalStr}`,
                "```",
            ];
            assert(false, assertMsg.join("\n"));
        }
        return Boolean(res);
    }

    static evaluateRuleExist (cwd: string, ruleExists: string[] | {paths: string[]} | undefined): boolean {
        if (ruleExists === undefined) return true;

        // Normalize rules:exists:paths to rules:exists
        if (!Array.isArray(ruleExists)) ruleExists = ruleExists.paths;

        for (const pattern of ruleExists) {
            if (pattern == "") {
                continue;
            }
            if (globby.sync(pattern, {dot: true, cwd}).length > 0) {
                return true;
            }
        }
        return false;
    }

    static evaluateRuleChanges (defaultBranch: string, ruleChanges: string[] | {paths: string[]} | undefined, cwd: string): boolean {
        if (ruleChanges === undefined) return true;

        // Normalize rules:changes:paths to rules:changes
        if (!Array.isArray(ruleChanges)) ruleChanges = ruleChanges.paths;

        // NOTE: https://docs.gitlab.com/ee/ci/yaml/#ruleschanges
        //   Glob patterns are interpreted with Ruby's [File.fnmatch](https://docs.ruby-lang.org/en/master/File.html#method-c-fnmatch)
        //   with the flags File::FNM_PATHNAME | File::FNM_DOTMATCH | File::FNM_EXTGLOB.
        return micromatch.some(GitData.changedFiles(`origin/${defaultBranch}`, cwd), ruleChanges, {
            nonegate: true,
            noextglob: true,
            posix: false,
            dot: true,
        });
    }

    static isSubpath (lhs: string, rhs: string, cwd: string = process.cwd()) {
        let absLhs = "";
        if (path.isAbsolute(lhs)) {
            absLhs = lhs;
        } else {
            absLhs = path.resolve(cwd, lhs);
        }

        let absRhs = "";
        if (path.isAbsolute(rhs)) {
            absRhs = rhs;
        } else {
            absRhs = path.resolve(cwd, rhs);
        }

        const relative = path.relative(absRhs, absLhs);
        return !relative.startsWith("..");
    }

    static async rsyncTrackedFiles (cwd: string, stateDir: string, target: string): Promise<{hrdeltatime: [number, number]}> {
        const time = process.hrtime();
        await fs.mkdirp(`${cwd}/${stateDir}/builds/${target}`);
        await Utils.bash(`rsync -a --delete-excluded --delete --exclude-from=<(git ls-files -o --directory | awk '{print "/"$0}') --exclude ${stateDir}/ ./ ${stateDir}/builds/${target}/`, cwd);
        return {hrdeltatime: process.hrtime(time)};
    }

    static async checksumFiles (cwd: string, files: string[]): Promise<string> {
        const promises: Promise<string>[] = [];

        files.forEach((file) => {
            promises.push(new Promise((resolve, reject) => {
                if (! fs.pathExistsSync(file)) resolve(path.relative(cwd, file)); // must use relative path here, so that checksum can be deterministic when running the unit tests
                checksum.file(file, (err, hash) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve(hash);
                });
            }));
        });

        const result = await Promise.all(promises);
        return checksum(result.join(""));
    }

    static isObject (v: any) {
        return Object.getPrototypeOf(v) === Object.prototype;
    }

    static async remoteFileExist (cwd: string, file: string, ref: string, domain: string, projectPath: string, protocol: GitSchema, port: string) {
        switch (protocol) {
            case "ssh":
            case "git":
                try {
                    await Utils.spawn(`git archive --remote=ssh://git@${domain}:${port}/${projectPath}.git ${ref} ${file}`.split(" "), cwd);
                    return true;
                } catch (e: any) {
                    if (!e.stderr.includes(`remote: fatal: pathspec '${file}' did not match any files`)) throw new Error(e);
                    return false;
                }

            case "http":
            case "https": {
                try {
                    const axiosConfig: AxiosRequestConfig = Utils.getAxiosProxyConfig();
                    const {status} = await axios.get(
                        `${protocol}://${domain}:${port}/${projectPath}/-/raw/${ref}/${file}`,
                        axiosConfig,
                    );
                    return (status === 200);
                } catch {
                    return false;
                }
            }
            default: {
                Utils.switchStatementExhaustiveCheck(protocol);
            }
        }
    }

    static switchStatementExhaustiveCheck (param: never): never {
        // https://dev.to/babak/exhaustive-type-checking-with-typescript-4l3f
        throw new Error(`Unhandled case ${param}`);
    }

    static async dockerVolumeFileExists (containerExecutable: string, path: string, volume: string): Promise<boolean> {
        try {
            await Utils.spawn([containerExecutable, "run", "--rm", "-v", `${volume}:/mnt/vol`, "alpine", "ls", `/mnt/vol/${path}`]);
            return true;
        } catch {
            return false;
        }
    }

    static gclRegistryPrefix: string = "registry.gcl.local";
    static async startDockerRegistry (argv: Argv): Promise<void> {
        const gclRegistryCertVol = `${this.gclRegistryPrefix}.certs`;
        const gclRegistryDataVol = `${this.gclRegistryPrefix}.data`;
        const gclRegistryNet = `${this.gclRegistryPrefix}.net`;

        // create cert volume
        try {
            await Utils.spawn(`${argv.containerExecutable} volume create ${gclRegistryCertVol}`.split(" "));
        } catch (err) {
            if (err instanceof Error && !err.message.endsWith("already exists"))
                throw err;
        }

        // create self-signed cert/key files for https support
        if (!await this.dockerVolumeFileExists(argv.containerExecutable, `${this.gclRegistryPrefix}.crt`, gclRegistryCertVol)) {
            const opensslArgs = [
                "req", "-newkey", "rsa:4096", "-nodes", "-sha256",
                "-keyout", `/certs/${this.gclRegistryPrefix}.key`,
                "-x509", "-days", "365",
                "-out", `/certs/${this.gclRegistryPrefix}.crt`,
                "-subj", `/CN=${this.gclRegistryPrefix}`,
                "-addext", `subjectAltName=DNS:${this.gclRegistryPrefix}`,
            ];
            const generateCertsInPlace = [
                argv.containerExecutable, "run", "--rm", "-v", `${gclRegistryCertVol}:/certs`, "--entrypoint", "sh", "alpine/openssl", "-c",
                [
                    "openssl", ...opensslArgs,
                    "&&", "mkdir", "-p", `/certs/${this.gclRegistryPrefix}`,
                    "&&", "cp", `/certs/${this.gclRegistryPrefix}.crt`, `/certs/${this.gclRegistryPrefix}/ca.crt`,
                ].join(" "),
            ];
            await Utils.spawn(generateCertsInPlace);
        }

        // create data volume
        try {
            await Utils.spawn([argv.containerExecutable, "volume", "create", gclRegistryDataVol]);
        } catch (err) {
            if (err instanceof Error && !err.message.endsWith("already exists"))
                throw err;
        }

        // create network
        try {
            await Utils.spawn([argv.containerExecutable, "network", "create", gclRegistryNet]);
        } catch (err) {
            if (err instanceof Error && !err.message.includes("already exists"))
                throw err;
        }

        await Utils.spawn([argv.containerExecutable, "rm", "-f", this.gclRegistryPrefix]);
        await Utils.spawn([
            argv.containerExecutable, "run", "-d", "--name", this.gclRegistryPrefix,
            "--network", gclRegistryNet,
            "--volume", `${gclRegistryDataVol}:/var/lib/registry`,
            "--volume", `${gclRegistryCertVol}:/certs:ro`,
            "-e", "REGISTRY_HTTP_ADDR=0.0.0.0:443",
            "-e", `REGISTRY_HTTP_TLS_CERTIFICATE=/certs/${this.gclRegistryPrefix}.crt`,
            "-e", `REGISTRY_HTTP_TLS_KEY=/certs/${this.gclRegistryPrefix}.key`,
            "registry",
        ]);

        try {
            await execa(argv.containerExecutable, [
                "run", "--rm",
                "--network", gclRegistryNet,
                "--entrypoint", "sh",
                "curlimages/curl",
                "-c", `until [ "$(curl -s -o /dev/null -k -w "%{http_code}" https://${this.gclRegistryPrefix}:443)" = "200" ]; do sleep 1; done;`,
            ], {
                timeout: 4000,
            });
        } catch (err) {
            await this.stopDockerRegistry(argv.containerExecutable);
            if ((err as ExecaError).timedOut) {
                throw "local docker registry port check timed out";
            }
            throw err;
        }
    }

    static async stopDockerRegistry (containerExecutable: string): Promise<void> {
        await Utils.spawn([containerExecutable, "rm", "-f", this.gclRegistryPrefix]);
    }

    static async getTrackedFiles (cwd: string): Promise<string[]> {
        const lsFilesRes = await Utils.bash("git ls-files --deduplicate", cwd);
        if (lsFilesRes.exitCode != 0) {
            throw new Error(`Failed to list tracked files in ${cwd}: ${lsFilesRes.stderr}`);
        }
        return lsFilesRes.stdout.split("\n");
    }

    static getAxiosProxyConfig (): AxiosRequestConfig {
        const proxyEnv = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyEnv) {
            const proxyUrl = new URL(proxyEnv);
            return {
                proxy: {
                    host: proxyUrl.hostname,
                    port: proxyUrl.port ? parseInt(proxyUrl.port, 10) : 8080,
                    protocol: proxyUrl.protocol.replace(":", ""),
                },
            };
        }
        return {};
    }
}
