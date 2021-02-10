import {blueBright} from "ansi-colors";

export class Utils {

    static printJobNames(job: { name: string }, i: number, arr: { name: string }[]) {
        if (i === arr.length - 1) {
            process.stdout.write(`${blueBright(`${job.name}`)}`);
        } else {
            process.stdout.write(`${blueBright(`${job.name}`)}, `);
        }
    }

    static expandText(text?: any, envs: { [key: string]: string | undefined } = process.env) {
        if (typeof text !== 'string') {
            return text;
        }
        return text.replace(/[$][{]?\w*[}]?/g, (match) => {
            const sub = envs[match.replace(/^[$][{]?/, '').replace(/[}]?$/, '')];
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

    static getRulesResult(rules: { if?: string, when?: string, allow_failure?: boolean }[], variables: { [key: string]: string }): { when: string, allowFailure: boolean } {
        let when = 'never';
        let allowFailure = false;

        for (const rule of rules) {
            if (!Utils.evaluateRuleIf(rule.if || "true", variables)) {
                continue;
            }
            when = rule.when ? rule.when : 'on_success';
            allowFailure = rule.allow_failure ? rule.allow_failure : allowFailure;
        }

        return {when, allowFailure};
    }

    static evaluateRuleIf(ruleIf: string, envs: { [key: string]: string }) {
        const expandedRule = ruleIf.replace(/[$]\w*/g, (match) => {
            const sub = envs[match.replace(/^[$]/, '')];
            return sub != null ? `'${sub}'` : 'null';
        });

        const subRules = expandedRule.split(/&&|\|\|/g);
        const subEvals = [];
        for (const subRule of subRules) {
            let subEval = subRule;

            if (subRule.includes('!~')) {
                subEval = subRule.replace(/\s*!~\s*(\/.*\/)/, `.match($1) == null`);
            } else if (subRule.includes('=~')) {
                subEval = subRule.replace(/\s*=~\s*(\/.*\/)/, `.match($1) != null`);
            } else if (!subRule.match(/(?:==)|(?:!=)/)) {
                if (subRule.match(/null/)) {
                    subEval = subRule.replace(/(\s*)\S*(\s*)/, '$1false$2');
                } else if (subRule.match(/''/)) {
                    subEval = subRule.replace(/'(\s?)\S*(\s)?'/, '$1false$2');
                } else {
                    subEval = subRule.replace(/'(\s?)\S*(\s)?'/, '$1true$2');
                }
            }

            subEvals.push(subEval);
        }

        const conditions = expandedRule.match(/&&|\|\|/g);

        let evalStr = '';

        subEvals.forEach((subEval, index) => {
            evalStr += subEval;
            evalStr += conditions && conditions[index] ? conditions[index] : '';
        });

        return eval(evalStr);
    }
}
