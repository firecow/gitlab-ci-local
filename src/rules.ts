import "./global.js";
import {RE2JS} from "re2js";
import chalk from "chalk-template";
import assert from "node:assert";
import {globbySync} from "globby";
import micromatch from "micromatch";
import {JobRule, Need} from "./job.js";
import {needsComplex} from "./data-expander.js";
import {GitData} from "./git-data.js";
import {Argv} from "./argv.js";
import {expandTextWith} from "./expand.js";

type RuleResultOpt = {
    argv: Argv;
    cwd: string;
    rules: JobRule[];
    variables: {[key: string]: string};
};

export function getRulesResult (opt: RuleResultOpt, gitData: GitData, jobWhen: string = "on_success", jobAllowFailure: boolean | {exit_codes: number | number[]} | undefined = undefined): {when: string; allowFailure: boolean | {exit_codes: number | number[]}; variables?: {[name: string]: string}; needs?: Need[]} {
    let when = "never";
    const {evaluateRuleChanges: shouldEvaluateRuleChanges} = opt.argv;

    // optional manual jobs allowFailure defaults to true https://docs.gitlab.com/ee/ci/jobs/job_control.html#types-of-manual-jobs
    let allowFailure: boolean | {exit_codes: number | number[]} = jobAllowFailure ?? jobWhen === "manual";
    let ruleVariable: {[name: string]: string} | undefined;
    let ruleNeeds: Need[] | undefined;

    for (const rule of opt.rules) {
        if (!evaluateRuleIf(rule.if, opt.variables)) continue;
        if (!evaluateRuleExist(opt.cwd, rule.exists)) continue;
        if (shouldEvaluateRuleChanges && !evaluateRuleChanges(gitData.branches.default, rule.changes, opt.cwd)) continue;

        when = rule.when ? rule.when : jobWhen;
        allowFailure = rule.allow_failure ?? allowFailure;
        ruleVariable = rule.variables;
        ruleNeeds = rule.needs?.map((n: any) => needsComplex(n));

        break; // Early return, will not evaluate the remaining rules
    }

    return {when, allowFailure, variables: ruleVariable, needs: ruleNeeds};
}

export function evaluateRuleIf (ruleIf: string | undefined, envs: {[key: string]: string}): boolean {
    if (ruleIf === undefined) return true;
    assert(typeof ruleIf === "string", chalk`This GitLab CI configuration is invalid: {blueBright rules:if} must be a string, but got {red ${JSON.stringify(ruleIf)}}`);
    assert(!/\$\{\w+\}/.test(ruleIf), chalk`rules:rule if invalid expression syntax: {blueBright ${ruleIf}}\nuse {green $VAR} not {red \${VAR\}} in rules:if`);
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
    evalStr = expandTextWith(evalStr, {
        unescape: JSON.stringify("$"),
        variable: (name) => JSON.stringify(envs[name] ?? null).replaceAll("\\\\", "\\"),
    });
    const expandedEvalStr = evalStr;

    // Scenario when RHS is a <regex>
    // https://regexr.com/85sjo
    const pattern1 = /(?:(?<!\s)|(?<=\/[igmsuy]*\s))\s*(?<operator>(?:=~)|(?:!~))\s*\/(?<rhs>.*?[^\\])\/(?<flags>[igmsuy]*)(\s|$|\))/g;
    evalStr = evalStr.replaceAll(pattern1, (_, operator, rhs, flags, remainingTokens) => {
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
    const pattern2 = /(?<!\s)\s*(?<operator>=~|!~)\s*(["'])(?<rhs>(?:\\.|[^\\])*?)\2/g;
    evalStr = evalStr.replaceAll(pattern2, (_, operator, __, rhs) => {
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

        if (!(/^\/(.*)\/(\w*)$/.test(rhs))) {
            // Pattern is not a regex
            // This is discouraged by gitlab, but it is supported
            // We match gitlab's behavior which is to check if lhs is a substring of rhs
            // See https://docs.gitlab.com/ci/jobs/job_rules/#unexpected-behavior-from-regular-expression-matching-with-

            // This is a weird construction, as the lhs string will be prepended, and we have to be able to use it as a parameter of includes
            return `?.split().some((lhs) => ${JSON.stringify(rhs)}.includes(lhs)) ${operator === "=~" ? "!==" : "==="} false`;
        }

        const regex = /\/(?<pattern>.*)\/(?<flags>[igmsuy]*)/;
        const _rhs = rhs.replace(regex, (_: string, pattern: string, flags: string) => {
            const flagsBinary = flagsToBinary(flags);
            const escapedPattern = JSON.stringify(pattern);
            return `RE2JS.compile(${escapedPattern}, ${flagsBinary})`;
        });
        return `.matchRE2JS(${_rhs}) ${_operator} null`;
    });

    evalStr = evalStr.replaceAll(/(?:(?<![\w"'])null|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\s*(=~|!~)\s*null\b/g, (_, operator) => operator === "=~" ? "false" : "true");
    evalStr = evalStr.replaceAll(/null.matchRE2JS\(.+?\)\s*!=\s*null/g, "false");
    evalStr = evalStr.replaceAll(/null.matchRE2JS\(.+?\)\s*==\s*null/g, "true");

    evalStr = evalStr.trim();

    let res;
    try {
        (globalThis as any).RE2JS = RE2JS;
        res = (0, eval)(evalStr); // indirect eval
        delete (globalThis as any).RE2JS;
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

function evaluateRuleExist (cwd: string, ruleExists: string[] | {paths: string[]} | undefined): boolean {
    if (ruleExists === undefined) return true;

    // Normalize rules:exists:paths to rules:exists
    if (!Array.isArray(ruleExists)) ruleExists = ruleExists.paths;

    for (const pattern of ruleExists) {
        if (pattern == "") {
            continue;
        }
        if (globbySync(pattern, {dot: true, cwd}).length > 0) {
            return true;
        }
    }
    return false;
}

export function evaluateRuleChanges (defaultBranch: string, ruleChanges: string[] | {paths: string[]} | undefined, cwd: string): boolean {
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
