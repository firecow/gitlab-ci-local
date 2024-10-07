import chalk from "chalk";
import {Job, JobRule} from "./job";
import * as fs from "fs-extra";
import checksum from "checksum";
import base64url from "base64url";
import execa from "execa";
import assert from "assert";
import {CICDVariable} from "./variables-from-files";
import {GitData, GitSchema} from "./git-data";
import globby from "globby";
import micromatch from "micromatch";
import axios from "axios";
import path from "path";

type RuleResultOpt = {
    cwd: string;
    rules: JobRule[];
    variables: {[key: string]: string};
};

type ExpandWith = {
    unescape: string;
    variable: (name: string) => string;
};

export class Utils {
    static removePrefix = (value: string, prefix: string) =>
        value.startsWith(prefix) ? value.slice(prefix.length) : value;

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

        const regex = new RegExp(coverageRegex.replace(/^\//, "").replace(/\/$/, ""), "gm");
        const matches = Array.from(content.matchAll(regex));
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
            }
        );
    }

    static expandText (text: any, envs: {[key: string]: string}) {
        return this.expandTextWith(text, {
            unescape: "$",
            variable: (name) => envs[name] ?? "",
        });
    }

    static expandVariables (variables: {[key: string]: string}) {
        let expandedAnyVariables, i = 0;
        do {
            assert(i < 100, "Recursive variable expansion reached 100 iterations");
            expandedAnyVariables = false;
            for (const [k, v] of Object.entries(variables)) {
                const envsWithoutSelf = {...variables};
                delete envsWithoutSelf[k];
                // If the $$'s are converted to single $'s now, then the next
                // iteration, they might be interpreted as variables, even
                // though they were *explicitly* escaped. To work around this,
                // leave the '$$'s as the same value, then only unescape them at
                // the very end.
                variables[k] = Utils.expandTextWith(v, {
                    unescape: "$$",
                    variable: (name) => envsWithoutSelf[name] ?? "",
                });
                expandedAnyVariables ||= variables[k] !== v;
            }
            i++;
        } while (expandedAnyVariables);

        return variables;
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

        // optional manual jobs allowFailure defaults to true https://docs.gitlab.com/ee/ci/jobs/job_control.html#types-of-manual-jobs
        let allowFailure = jobWhen === "manual" ? true : jobAllowFailure;
        let ruleVariable: {[name: string]: string} | undefined;

        for (const rule of opt.rules) {
            if (!Utils.evaluateRuleIf(rule.if, opt.variables)) continue;
            if (!Utils.evaluateRuleExist(opt.cwd, rule.exists)) continue;
            if (!Utils.evaluateRuleChanges(gitData.branches.default, rule.changes)) continue;

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

        // Expand all variables
        evalStr = this.expandTextWith(evalStr, {
            unescape: JSON.stringify("$"),
            variable: (name) => JSON.stringify(envs[name] ?? null).replaceAll("\\\\", "\\"),
        });
        const expandedEvalStr = evalStr;

        // Scenario when RHS is a <regex>
        // https://regexr.com/85sjo
        const pattern1 = /\s*(?<operator>(?:=~)|(?:!~))\s*(?<rhs>\/.*?\/)(?<flags>[igmsuy]*)(\s|$|\))/g;
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
            return `.match(${rhs}${flags})${remainingTokens} ${_operator} null `;
        });

        // Scenario when RHS is surrounded by double-quotes
        // https://regexr.com/85t0g
        const pattern2 = /\s*(?<operator>(?:=~)|(?:!~))\s*"(?<rhs>[^"\\]*(?:\\.[^"\\]*)*)"/g;
        evalStr = evalStr.replace(pattern2, (_, operator, rhs) => {
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

            if (!/\/(.*)\/([\w]*)/.test(rhs)) {
                throw Error(`RHS (${rhs}) must be a regex pattern. Do not rely on this behavior!
Refer to https://docs.gitlab.com/ee/ci/jobs/job_rules.html#unexpected-behavior-from-regular-expression-matching-with- for more info...`);
            }
            const regex = /\/(?<pattern>.*)\/(?<flags>[igmsuy]*)/;
            const _rhs = rhs.replace(regex, (_: string, pattern: string, flags: string) => {
                const _pattern = pattern.replace(/(?<!\\)\//g, "\\/"); // escape potentially unescaped `/` that's in the pattern
                return `/${_pattern}/${flags}`;
            });
            return `.match(new RegExp(${_rhs})) ${_operator} null`;
        });

        // Convert all null.match functions to false
        evalStr = evalStr.replace(/null.match\(.+?\)\s*!=\s*null/g, "false");
        evalStr = evalStr.replace(/null.match\(.+?\)\s*==\s*null/g, "false");

        evalStr = evalStr.trim();

        let res;
        try {
            res = eval(evalStr);
        } catch (err) {
            console.log(`
Error attempting to evaluate the following rules:
  rules:
    - if: '${expandedEvalStr}'
as
\`\`\`javascript
${evalStr}
\`\`\`
`);
            throw err;
        }
        return Boolean(res);
    }

    static evaluateRuleExist (cwd: string, ruleExists: string[] | undefined): boolean {
        if (ruleExists === undefined) return true;
        for (const pattern of ruleExists) {
            if (globby.sync(pattern, {dot: true, cwd}).length > 0) {
                return true;
            }
        }
        return false;
    }

    static evaluateRuleChanges (defaultBranch: string, ruleChanges: string[] | {paths: string[]} | undefined): boolean {
        if (ruleChanges === undefined) return true;

        // Normalize rules:changes:paths to rules:changes
        if (!Array.isArray(ruleChanges)) ruleChanges = ruleChanges.paths;

        // NOTE: https://docs.gitlab.com/ee/ci/yaml/#ruleschanges
        //       Glob patterns are interpreted with Ruby's [File.fnmatch](https://docs.ruby-lang.org/en/master/File.html#method-c-fnmatch)
        //       with the flags File::FNM_PATHNAME | File::FNM_DOTMATCH | File::FNM_EXTGLOB.
        return micromatch.some(GitData.changedFiles(`origin/${defaultBranch}`), ruleChanges, {
            nonegate: true,
            noextglob: true,
            posix: false,
            dot: true,
        });
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
                    const {status} = await axios.get(`${protocol}://${domain}/${projectPath}/-/raw/${ref}/${file}`);
                    return (status === 200);
                } catch (e) {
                    return false;
                }
            }
            default: {
                Utils.switchStatementExhaustiveCheck(protocol);
            }
        }
    }

    static trimSuffix (str: string, suffix: string) {
        return str.endsWith(suffix) ? str.slice(0, -suffix.length) : str;
    }

    static switchStatementExhaustiveCheck (param: never): never {
        // https://dev.to/babak/exhaustive-type-checking-with-typescript-4l3f
        throw new Error(`Unhandled case ${param}`);
    }
}
