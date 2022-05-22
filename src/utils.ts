import chalk from "chalk";
import {Job} from "./job";
import {assert} from "./asserts";
import * as fs from "fs-extra";
import checksum from "checksum";
import base64url from "base64url";
import execa from "execa";

export class Utils {

    static bash(shellScript: string, cwd = process.cwd(), env = process.env): execa.ExecaChildProcess {
        return execa(shellScript, {shell: "bash", cwd, env, all: true});
    }

    static spawn(cmdArgs: string[], cwd = process.cwd(), env = process.env): execa.ExecaChildProcess {
        return execa(cmdArgs[0], cmdArgs.slice(1), {cwd, env, all: true});
    }

    static fsUrl(url: string): string {
        return url.replace(/^https:\/\//g, "").replace(/^http:\/\//g, "");
    }

    static getJobByName(jobs: ReadonlyMap<string, Job>, name: string): Job {
        const job = jobs.get(name);
        assert(job != null, chalk`{blueBright ${name}} could not be found`);
        return job;
    }

    static getSafeJobName(jobName: string) {
        return jobName.replace(/[^\w-]+/g, (match) => {
            return base64url.encode(match);
        });
    }

    static forEachRealJob(gitlabData: any, callback: (jobName: string, jobData: any) => void) {
        for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
            if (Job.illegalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }
            callback(jobName, jobData);
        }
    }

    static getJobNamesFromPreviousStages(jobs: ReadonlyMap<string, Job>, stages: readonly string[], currentJob: Job) {
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

    static async getCoveragePercent(cwd: string, stateDir: string, coverageRegex: string, jobName: string) {
        const content = await fs.readFile(`${cwd}/${stateDir}/output/${jobName}.log`, "utf8");
        const regex = new RegExp(coverageRegex.replace(/^\//, "").replace(/\/$/, ""), "m");
        const match = content.match(regex);
        if (match && match[0] != null) {
            const firstNumber = match[0].match(/\d+(\.\d+)?/);
            return firstNumber && firstNumber[0] ? firstNumber[0] : null;
        }
        return "0";
    }

    static printJobNames(stream: (txt: string) => void, job: { name: string }, i: number, arr: { name: string }[]) {
        if (i === arr.length - 1) {
            stream(chalk`{blueBright ${job.name}}`);
        } else {
            stream(chalk`{blueBright ${job.name}}, `);
        }
    }

    static expandText(text?: any, envs: { [key: string]: string | undefined } = process.env) {
        if (typeof text !== "string") {
            return text;
        }
        return text.replace(/[$][{]?\w*[}]?/g, (match) => {
            const sub = envs[match.replace(/^[$][{]?/, "").replace(/[}]?$/, "")];
            return sub || "";
        });
    }

    static expandVariables(variables: { [key: string]: string }, envs: { [key: string]: string }): { [key: string]: string } {
        const expandedVariables: { [key: string]: string } = {};
        for (const [key, value] of Object.entries(variables)) {
            expandedVariables[key] = Utils.expandText(value, envs);
        }
        return expandedVariables;
    }

    static textHasVariable(text?: any): boolean {
        if (typeof text !== "string") {
            return false;
        }
        return text.match(/[$][{]?\w*[}]?/g) != null;
    }

    static getRulesResult(rules: { if?: string; when?: string; allow_failure?: boolean }[], variables: { [key: string]: string }): { when: string; allowFailure: boolean } {
        let when = "never";
        let allowFailure = false;

        for (const rule of rules) {
            if (Utils.evaluateRuleIf(rule.if || "true", variables)) {
                when = rule.when ? rule.when : "on_success";
                allowFailure = rule.allow_failure ?? false;
                break;
            }
        }

        return {when, allowFailure};
    }

    static evaluateRuleIf(ruleIf: string, envs: { [key: string]: string }) {
        let evalStr = ruleIf;

        // Expand all variables
        evalStr = evalStr.replace(/[$]\w+/g, (match) => {
            const sub = envs[match.replace(/^[$]/, "")];
            return sub != null ? `'${sub}'` : "null";
        });

        // Convert =~ to match function
        evalStr = evalStr.replace(/\s*=~\s*(\/.*?\/[igmsuy]*)/g, ".match($1) != null");
        evalStr = evalStr.replace(/\s*=~\s(.+?)(\)*?)(?:\s|$)/g, ".match(new RegExp($1)) != null$2"); // Without forward slashes

        // Convert !~ to match function
        evalStr = evalStr.replace(/\s*!~\s*(\/.*?\/[igmsuy]*)/g, ".match($1) == null");
        evalStr = evalStr.replace(/\s*!~\s(.+?)(\)*?)(?:\s|$)/g, ".match(new RegExp($1)) == null$2"); // Without forward slashes

        // Convert all null.match functions to false
        evalStr = evalStr.replace(/null.match\(.+?\) != null/g, "false");
        evalStr = evalStr.replace(/null.match\(.+?\) == null/g, "false");

        // noinspection BadExpressionStatementJS
        return eval(`if (${evalStr}) { true } else { false }`);
    }

    static async rsyncTrackedFiles(cwd: string, stateDir: string, target: string): Promise<{ hrdeltatime: [number, number] }> {
        const time = process.hrtime();
        await fs.mkdirp(`${cwd}/${stateDir}/builds/${target}`);
        await Utils.bash(`rsync -a --delete-excluded --delete --exclude-from=<(git ls-files -o --directory | awk '{print "/"$0}') --exclude ${stateDir}/ ./ ${stateDir}/builds/${target}/`, cwd);
        return {hrdeltatime: process.hrtime(time)};
    }

    static async checksumFiles(files: string[]): Promise<string> {
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
}
