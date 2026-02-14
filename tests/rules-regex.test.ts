import {spyOn, mock, beforeEach, describe, test, expect} from "bun:test";
import "../src/global.js";
import {Argv} from "../src/argv";
import {Utils} from "../src/utils";
import {GitData} from "../src/git-data";
import {WriteStreamsMock} from "../src/write-streams";

let writeStreams;
let gitData: GitData;
let argv: Argv;

beforeEach(async () => {
    writeStreams = new WriteStreamsMock();
    gitData = await GitData.init("tests", writeStreams);
    argv = await Argv.build({}, writeStreams);
    mock.restore();
});

/* eslint-disable @stylistic/quotes */
const tests = [
    {
        rule: '"Hello World" =~ "/hello world/i"',
        jsExpression: '"Hello World".matchRE2JS(RE2JS.compile("hello world", 1)) != null',
        evalResult: true,
    },
    {
        rule: '"Hello World" =~ /hello world/i',
        jsExpression: '"Hello World".matchRE2JS(RE2JS.compile("hello world", 1)) != null',
        evalResult: true,
    },
    {
        rule: '"Hello World" =~ /Hello (?i)world/',
        jsExpression: '"Hello World".matchRE2JS(RE2JS.compile("Hello (?i)world", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"1.11" =~ /^([[:digit:]]+(.[[:digit:]]+)*|latest)$/',
        jsExpression: '"1.11".matchRE2JS(RE2JS.compile("^([[:digit:]]+(.[[:digit:]]+)*|latest)$", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"foo" !~ /foo/',
        jsExpression: '"foo".matchRE2JS(RE2JS.compile("foo", 0)) == null',
        evalResult: false,
    },
    {
        rule: '"foo" =~ /foo/',
        jsExpression: '"foo".matchRE2JS(RE2JS.compile("foo", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~ /foo/',
        jsExpression: '"foo".matchRE2JS(RE2JS.compile("foo", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~/foo/',
        jsExpression: '"foo".matchRE2JS(RE2JS.compile("foo", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~  /foo/',
        jsExpression: '"foo".matchRE2JS(RE2JS.compile("foo", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"foo" =~ "/foo/"',
        jsExpression: '"foo".matchRE2JS(RE2JS.compile("foo", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ "/test/ur/"',
        jsExpression: '"test/url".matchRE2JS(RE2JS.compile("test/ur", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ "/test\\/ur/"',
        jsExpression: '"test/url".matchRE2JS(RE2JS.compile("test\\/ur", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ /test/ur/',
        expectedErrSubStr: "Error attempting to evaluate the following rules:",
    },
    {
        rule: '"master" =~ /master$/',
        jsExpression: '"master".matchRE2JS(RE2JS.compile("master$", 0)) != null',
        evalResult: true,
    },
    {
        rule: '"23" =~ "1234"',
        expectedErrSubStr: "must be a regex pattern. Do not rely on this behavior!",
    },
    {
        rule: '"23" =~ \'1234\'',
        expectedErrSubStr: "must be a regex pattern. Do not rely on this behavior!",
    },
    {
        rule: '"23" =~ /1234/',
        jsExpression: '"23".matchRE2JS(RE2JS.compile("1234", 0)) != null',
        evalResult: false,
    },
    {
        rule: '$CI_COMMIT_BRANCH && $GITLAB_FEATURES =~ /\bdependency_scanning\b/ && $CI_GITLAB_FIPS_MODE == "true"',
        jsExpression: 'null && false && null == "true"',
        evalResult: false,
    },
    {
        rule: '($CI_MERGE_REQUEST_SOURCE_BRANCH_NAME =~ /^perf_.*$/)',
        jsExpression: '(false)', // (null.matchRE2JS(RE2JS.compile("^perf_.*$", 0)) != null => (false)
        evalResult: false,
    },
    {
        rule: '("qwerty" =~ /^perf_.*$/)',
        jsExpression: '("qwerty".matchRE2JS(RE2JS.compile("^perf_.*$", 0)) != null)',
        evalResult: false,
    },
    {
        rule: `"product-name/v0.0.0+build.0" =~ /^(?:product-name\\/)?v\\d+\\.\\d+\\.\\d+.*/`,
        jsExpression: "\"product-name/v0.0.0+build.0\".matchRE2JS(RE2JS.compile(\"^(?:product-name\\\\/)?v\\\\d+\\\\.\\\\d+\\\\.\\\\d+.*\", 0)) != null",
        evalResult: true,
    },
];
/* eslint-enable @stylistic/quotes */

describe("gitlab rules regex", () => {
    tests.filter(t => !t.expectedErrSubStr)
        .forEach((t) => {
            test(`- if: '${t.rule}'\n\t => ${t.evalResult}`, async () => {
                const rules = [ {if: t.rule} ];
                const evalSpy = spyOn(global, "eval");
                const evaluateRuleIfSpy = spyOn(Utils, "evaluateRuleIf");

                Utils.getRulesResult({argv, cwd: "", rules, variables: {}}, gitData);
                expect(evaluateRuleIfSpy).toHaveReturnedWith(t.evalResult);
                expect(evalSpy).toHaveBeenCalledWith(t.jsExpression);
            });
        });
});

describe("gitlab rules regex [invalid]", () => {
    tests.filter(t => t.expectedErrSubStr)
        .forEach((t) => {
            test(`- if: '${t.rule}'\n\t to throws error that contains \`${t.expectedErrSubStr}\``, async () => {
                const rules = [ {if: t.rule} ];

                try {
                    Utils.getRulesResult({argv, cwd: "", rules, variables: {}}, gitData);
                } catch (e: any) {
                    expect(e.message).toContain(t.expectedErrSubStr);
                    return;
                }

                throw new Error("Error is expected but not thrown/caught");
            });
        });
});
