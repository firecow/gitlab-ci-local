import * as c from "ansi-colors";

export class Utils {
    static printJobNames(job: { name: string }, i: number, arr: { name: string }[]) {
        if (i === arr.length - 1) {
            process.stdout.write(`${c.blueBright(`${job.name}`)}`);
        } else {
            process.stdout.write(`${c.blueBright(`${job.name}`)}, `);
        }
    }

    static printToStream(text: string, stream: 'stdout'|'stderr') {
        const colorize = (l: string) => {
            return stream === 'stderr' ? c.red(l) : l;
        }
        const writeStream = stream === 'stdout' ? process.stdout : process.stderr
        for (const line of text.split(/\r?\n/)) {
            if (line.length === 0) continue;
            writeStream.write(`${colorize(`${line}`)}\n`)
        }
    }

    static expandEnv(text?: any, envs: { [key: string]: string | undefined } = process.env) {
        if (typeof text !== 'string') return text;
        return text.replace(/[$][{]?\w*[}]?/g, (match) => {
            const sub = envs[match.replace(/^[$][{]?/, '').replace(/[}]?$/, '')];
            return sub || match;
        });
    }

    public static evaluateRuleIf(ruleIf: string, envs: { [key: string]: string }) {
        const expandedRule = ruleIf.replace(/[$]\w*/g, (match) => {
            const sub = envs[match.replace(/^[$]/, '')];
            return sub != null ? `'${sub}'` : 'null';
        });

        const subRules = expandedRule.split(/&&|\|\|/g);
        const subEvals = [];
        for (const subRule of subRules) {
            let subEval = subRule;
            if (!subRule.match(/(?:==)|(?:!=)|(?:=~)|(?:!~)/)) {
                subEval = subRule.trim() !== 'null' && subRule.trim() !== "''" ? 'true' : 'false';
            }

            if (subRule.includes('!~')) {
                subEval = subRule.replace(/\s?!~\s?(\/.*\/)/, `.match($1) == null`);
            }

            if (subRule.includes('=~')) {
                subEval = subRule.replace(/\s?=~\s?(\/.*\/)/, `.match($1) != null`);
            }
            subEvals.push(subEval);
        }

        const conditions = expandedRule.match(/&&|\|\|/g)

        let evalStr = '';

        subEvals.forEach((subEval, index) => {
            evalStr += subEval;
            evalStr += conditions && conditions[index] ? conditions[index] : '';
        })

        return eval(evalStr);
    }
}
