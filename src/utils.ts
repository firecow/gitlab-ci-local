import chalk from "chalk";
import {Job} from "./job";
import * as fs from "fs-extra";
import checksum from "checksum";
import base64url from "base64url";
import execa from "execa";
import {assert} from "./asserts";
import {CICDVariable} from "./variables-from-files";
import globby from "globby";

type RuleResultOpt = {
    cwd: string;
    rules: {
        if?: string;
        when?: string;
        exists?: string[];
        allow_failure?: boolean;
        variables?: {[name: string]: string};
    }[];
    variables: {[key: string]: string};
};

type ExpandWith = {
    unescape: string;
    variable: (name: string) => string;
};

export class Utils {
    static bash (shellScript: string, cwd = process.cwd(), env = process.env): execa.ExecaChildProcess {
        return execa(shellScript, {shell: "bash", cwd, env, all: true});
    }

    static spawn (cmdArgs: string[], cwd = process.cwd(), env = process.env): execa.ExecaChildProcess {
        return execa(cmdArgs[0], cmdArgs.slice(1), {cwd, env, all: true});
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
            if (Job.illegalJobNames.includes(jobName) || jobName[0] === ".") {
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
        const regex = new RegExp(coverageRegex.replace(/^\//, "").replace(/\/$/, ""), "m");
        const match = content.match(regex);
        if (match && match[0] != null) {
            const firstNumber = match[0].match(/\d+(\.\d+)?/);
            return firstNumber && firstNumber[0] ? firstNumber[0] : null;
        }
        return "0";
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
            /(\$\$)|\$\{([a-zA-Z_]\w*)}?|\$([a-zA-Z_]\w*)/g,
            (_match, escape, var1, var2) => {
                if (typeof escape !== "undefined") {
                    return expandWith.unescape;
                } else {
                    const name = var1 || var2;
                    assert(name, "unexpected unset capture group");
                    let value = expandWith.variable(name);
                    if (value.startsWith("\"/") && value.endsWith("/\"")) {
                        value = value.substring(1).slice(0, -1);
                    }
                    return `${value}`;
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

    static expandVariables (variables: {[key: string]: string}, envs: {[key: string]: string}): {[key: string]: string} {
        const expandedVariables: {[key: string]: string} = {};
        for (const [key, value] of Object.entries(variables)) {
            expandedVariables[key] = Utils.expandText(value, envs);
        }
        return expandedVariables;
    }

    static expandRecursive (variables: {[key: string]: string}) {
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

        // Now that recursive expansion has taken place, unescape $$'s.
        for (const [k, v] of Object.entries(variables)) {
            variables[k] = Utils.expandText(v, {});
        }

        return variables;
    }

    static findEnvMatchedVariables (variables: {[name: string]: CICDVariable}, fileVariablesDir: string, environment?: {name: string}) {
        const envMatchedVariables: {[key: string]: string} = {};
        for (const [k, v] of Object.entries(variables)) {
            for (const entry of v.environments) {
                if (environment?.name.match(entry.regexp) || entry.regexp.source === ".*") {
                    if (v.type === "file" && !entry.fileSource) {
                        envMatchedVariables[k] = `${fileVariablesDir}/${k}`;
                        fs.mkdirpSync(`${fileVariablesDir}`);
                        fs.writeFileSync(`${fileVariablesDir}/${k}`, entry.content);
                    } else if (v.type === "file" && entry.fileSource) {
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

    static getRulesResult (opt: RuleResultOpt): {when: string; allowFailure: boolean; variables?: {[name: string]: string}} {
        let when = "never";
        let allowFailure = false;
        let ruleVariable: {[name: string]: string} | undefined;
        let ruleExists;

        for (const rule of opt.rules) {
            if (Utils.evaluateRuleIf(rule.if || "true", opt.variables)) {
                when = rule.when ? rule.when : "on_success";
                allowFailure = rule.allow_failure ?? false;
                ruleVariable = rule.variables;
                ruleExists = rule.exists;

                if (ruleExists && !Utils.evaludateRuleExist(opt.cwd, ruleExists)) {
                    when = "never";
                }

                break;
            }
        }

        return {when, allowFailure, variables: ruleVariable};
    }

    static evaluateRuleIf (ruleIf: string, envs: {[key: string]: string}) {
        let evalStr = ruleIf;

        // Expand all variables
        evalStr = this.expandTextWith(evalStr, {
            unescape: JSON.stringify("$"),
            variable: (name) => JSON.stringify(envs[name] ?? null),
        });

        // Convert =~ to match function
        evalStr = evalStr.replace(/\s*=~\s*(\/.*?\/[igmsuy]*)(?:\s|$)/g, ".match($1) != null");
        evalStr = evalStr.replace(/\s*=~\s(.+?)(\)*?)(?:\s|$)/g, ".match(new RegExp($1)) != null$2"); // Without forward slashes

        // Convert !~ to match function
        evalStr = evalStr.replace(/\s*!~\s*(\/.*?\/[igmsuy]*)(?:\s|$)/g, ".match($1) == null");
        evalStr = evalStr.replace(/\s*!~\s(.+?)(\)*?)(?:\s|$)/g, ".match(new RegExp($1)) == null$2"); // Without forward slashes

        // Convert all null.match functions to false
        evalStr = evalStr.replace(/null.match\(.+?\) != null/g, "false");
        evalStr = evalStr.replace(/null.match\(.+?\) == null/g, "false");

        // noinspection BadExpressionStatementJS
        return eval(`if (${evalStr}) { true } else { false }`);
    }

    static evaludateRuleExist (cwd: string, ruleExists: string[]): boolean {
        for (const pattern of ruleExists) {
            if (globby.sync(pattern, {dot: true, cwd}).length > 0) {
                return true;
            }
        }
        return false;
    }

    static async rsyncTrackedFiles (cwd: string, stateDir: string, target: string): Promise<{hrdeltatime: [number, number]}> {
        const time = process.hrtime();
        await fs.mkdirp(`${cwd}/${stateDir}/builds/${target}`);
        await Utils.bash(`rsync -a --delete-excluded --delete --exclude-from=<(git ls-files -o --directory | awk '{print "/"$0}') --exclude ${stateDir}/ ./ ${stateDir}/builds/${target}/`, cwd);
        return {hrdeltatime: process.hrtime(time)};
    }

    static async checksumFiles (files: string[]): Promise<string> {
        const promises: Promise<string>[] = [];

        files.forEach((file) => {
            promises.push(new Promise((resolve, reject) => {
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

    static async moveGitDirInSubmodules (cwd: string, stateDir: string, target: string): Promise<{hrdeltatime: [number, number]}> {
        const time = process.hrtime();
        const gitDirPath = `${stateDir}/builds/${target}/.git`;
        try {
            const gitDirToRemove = fs.readFileSync(`${cwd}/.git`, "utf8").split(":")[1].trim() + "/";
            const submoduleRootGitConfig = fs.readFileSync(`${cwd}/${gitDirToRemove}config`, "utf8");
            const submoduleRootGitConfigLines = submoduleRootGitConfig.split("\n");
            const submoduleRootWorktreeLineIndex = submoduleRootGitConfigLines.findIndex((line) => line.startsWith("\tworktree = "));
            const workTreeToRemove = submoduleRootGitConfigLines[submoduleRootWorktreeLineIndex].replace("\tworktree = ", "") + "/";

            fs.removeSync(`${cwd}/${gitDirPath}`);
            await fs.mkdirp(`${cwd}/${gitDirPath}`);
            await Utils.bash(`rsync -a --delete ${gitDirToRemove} ${gitDirPath}`, cwd);
            const configRelativePathQueue: string[] = [];
            configRelativePathQueue.push("");
            while (configRelativePathQueue.length > 0) {
                const configRelativePath = configRelativePathQueue.shift()?.toString();
                const configPath = cwd + "/" + gitDirPath + "/" + (configRelativePath === "" ? "" : `modules/${configRelativePath}/`) + "config";
                if (!fs.existsSync(configPath)) continue;
                const config = await fs.readFile(configPath, "utf8");
                const configLines = config.split("\n");
                const submodules = configLines.filter((line) => line.startsWith("[submodule"))
                    .map((line) => line.replace("[submodule \"", "").replace("\"]", ""));
                configRelativePathQueue.push(...submodules);

                const worktreeLineIndex = configLines.findIndex((line) => line.startsWith("\tworktree = "));
                if (configRelativePath === "") {
                    configLines.splice(worktreeLineIndex, 1);
                } else {
                    // remove workTreeToRemove string from worktree string only once
                    const worktree = configLines[worktreeLineIndex].replace("\tworktree = ", "../").replace(workTreeToRemove, "");
                    configLines[worktreeLineIndex] = "worktree = " + worktree;
                    const gitDirFilePath = cwd + "/" + gitDirPath + "/" + (configRelativePath === "" ? "" : `modules/${configRelativePath}/`) + worktree + "/" + ".git";
                    const gitDirStatement = await fs.readFile(gitDirFilePath, "utf8");
                    const newGitWorkingDir = gitDirStatement.split(":")[1].trim().replace(gitDirToRemove, ".git/");
                    await fs.writeFile(gitDirFilePath, `gitdir: ${newGitWorkingDir}`);
                }
                await fs.writeFile(configPath, configLines.join("\n"));
            }
        }
        catch (e) {
            // continue regardless of error
        }
        finally {
            // continue regardless of error
        }
        return {hrdeltatime: process.hrtime(time)};
    }
}
