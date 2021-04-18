import * as chalk from "chalk";
import * as childProcess from "child_process";
import {ExitError} from "./types/exit-error";
import {Job} from "./job";

export class Utils {

    static spawn(command: string, cwd = process.cwd(), env: { [key: string]: string | undefined } = process.env): Promise<{ stdout: string; stderr: string; output: string; status: number }> {
        return new Promise((resolve, reject) => {
            const cp = childProcess.spawn(command, {shell: "bash", env, cwd});

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

    static forEachRealJob(gitlabData: any, callback: (jobName: string, jobData: any) => void) {
        for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
            if (Job.illegalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }
            callback(jobName, jobData);
        }
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

    static getRulesResult(rules: { if?: string; when?: string; allow_failure?: string | boolean }[], variables: { [key: string]: string }): { when: string; allowFailure: boolean } {
        let when = "never";
        let allowFailure = false;

        for (const rule of rules) {
            if (Utils.evaluateRuleIf(rule.if || "true", variables)) {
                when = rule.when ? rule.when : "on_success";
                allowFailure = rule.allow_failure != null ? rule.allow_failure === "true" : false;
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
}
