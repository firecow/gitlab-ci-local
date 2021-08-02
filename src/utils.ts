import chalk from "chalk";
import * as childProcess from "child_process";
import {ExitError} from "./types/exit-error";
import {Job} from "./job";
import {assert} from "./asserts";
import * as fs from "fs-extra";
import base32Encode from "base32-encode";

export class Utils {

    static spawn(command: string, cwd = process.cwd(), env: { [key: string]: string | undefined } = process.env): Promise<{ stdout: string; stderr: string; output: string; status: number }> {
        return new Promise((resolve, reject) => {
            const cp = childProcess.spawn(`${command}`, {shell: "bash", env, cwd});

            let output = "";
            let stdout = "";
            let stderr = "";

            cp.stderr.on("data", (buff) => {
                stderr += buff.toString();
                output += buff.toString();
            });
            cp.stdout.on("data", (buff) => {
                stdout += buff.toString();
                output += buff.toString();
            });
            cp.on("exit", (status) => {
                if ((status ?? 0) === 0) {
                    return setTimeout(() => resolve({stdout, stderr, output, status: status ?? 0}), 10);
                }
                return setTimeout(() => reject(new ExitError(`${output}`)), 10);
            });
            cp.on("error", (e) => {
                return setTimeout(() => reject(new ExitError(`'${command}' had errors\n${e}`)), 10);
            });

        });
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
        return jobName.replace(/[^\w_-]+/g, (match) => {
            const buffer = new ArrayBuffer(match.length * 2);
            const bufView = new Uint16Array(buffer);
            for (let i = 0, len = match.length; i < len; i++) {
                bufView[i] = match.charCodeAt(i);
            }
            return base32Encode(buffer, "Crockford");
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

    static getJobNamesFromPreviousStages(gitlabData: any, stages: readonly string[], currentStage: string) {
        const jobNames: string[] = [];
        const currentStageIndex = stages.indexOf(currentStage);
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            const stageIndex = stages.indexOf(jobData.stage);
            if (stageIndex < currentStageIndex) {
                jobNames.push(jobName);
            }
        });
        return jobNames;
    }

    static async getCoveragePercent(cwd: string, coverageRegex: string, jobName: string) {
        const content = await fs.readFile(`${cwd}/.gitlab-ci-local/output/${jobName}.log`, "utf8");
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
            return sub || match;
        });
    }

    static expandVariables(variables: { [key: string]: string }, envs: { [key: string]: string }): { [key: string]: string } {
        const expandedVariables: { [key: string]: string } = {};
        for (const [key, value] of Object.entries(variables)) {
            expandedVariables[key] = Utils.expandText(value, envs);
        }
        return expandedVariables;
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
        const expandedRule = ruleIf.replace(/[$]\w*/g, (match) => {
            const sub = envs[match.replace(/^[$]/, "")];
            return sub != null ? `'${sub}'` : "null";
        });

        const subRules = expandedRule.split(/&&|\|\|/g);
        const subEvals = [];
        for (const subRule of subRules) {
            let subEval = subRule;

            if (subRule.includes("!~")) {
                subEval = subRule.replace(/\s*!~\s*(\/.*\/)/, ".match($1) == null");
                subEval = subEval.match(/^null/) ? "false" : subEval;
            } else if (subRule.includes("=~")) {
                subEval = subRule.replace(/\s*=~\s*(\/.*\/)/, ".match($1) != null");
                subEval = subEval.match(/^null/) ? "false" : subEval;
            } else if (!subRule.match(/==|!=/)) {
                if (subRule.match(/null/)) {
                    subEval = subRule.replace(/(\s*)\S*(\s*)/, "$1false$2");
                } else if (subRule.match(/''/)) {
                    subEval = subRule.replace(/'(\s?)\S*(\s)?'/, "$1false$2");
                } else {
                    subEval = subRule.replace(/'(\s?)\S*(\s)?'/, "$1true$2");
                }
            }

            subEvals.push(subEval);
        }

        const conditions = expandedRule.match(/&&|\|\|/g);

        let evalStr = "";

        subEvals.forEach((subEval, index) => {
            evalStr += subEval;
            evalStr += conditions && conditions[index] ? conditions[index] : "";
        });

        return eval(evalStr);
    }

    static async rsyncNonIgnoredFilesToBuilds(cwd: string, target: string): Promise<{ hrdeltatime: [number, number] }> {
        const time = process.hrtime();
        await fs.ensureDir(`${cwd}/.gitlab-ci-local/builds/${target}`);
        const excludeCmd = "git clean -xdn | sed 's/Would remove //g'";
        await Utils.spawn(`rsync -a --delete --exclude-from=<(${excludeCmd}) --exclude .gitlab-ci-local/ ./ .gitlab-ci-local/builds/${target}/`, cwd);
        return {hrdeltatime: process.hrtime(time)};
    }

}
