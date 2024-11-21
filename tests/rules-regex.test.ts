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
    import.meta.jest.clearAllMocks();
});

/* eslint-disable @typescript-eslint/quotes */
const tests = [
    {
        rule: '"Hello World" =~ "/hello world/i"',
        jsExpression: '"Hello World".match(new RE2("hello world", "i")) != null',
        evalResult: true,
    },
    {
        rule: '"Hello World" =~ /hello world/i',
        jsExpression: '"Hello World".match(new RE2("hello world", "i")) != null',
        evalResult: true,
    },
    {
        rule: '"Hello World" =~ /Hello (?i)world/',
        jsExpression: '"Hello World".match(new RE2("Hello (?i)world", "")) != null',
        evalResult: true,
    },
    {
        rule: '"1.11" =~ /^([[:digit:]]+(.[[:digit:]]+)*|latest)$/',
        jsExpression: '"1.11".match(new RE2("^([[:digit:]]+(.[[:digit:]]+)*|latest)$", "")) != null',
        evalResult: true,
    },
    {
        rule: '"foo" !~ /foo/',
        jsExpression: '"foo".match(new RE2("foo", "")) == null',
        evalResult: false,
    },
    {
        rule: '"foo" =~ /foo/',
        jsExpression: '"foo".match(new RE2("foo", "")) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~ /foo/',
        jsExpression: '"foo".match(new RE2("foo", "")) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~/foo/',
        jsExpression: '"foo".match(new RE2("foo", "")) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~  /foo/',
        jsExpression: '"foo".match(new RE2("foo", "")) != null',
        evalResult: true,
    },
    {
        rule: '"foo" =~ "/foo/"',
        jsExpression: '"foo".match(new RE2("foo", "")) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ "/test/ur/"',
        jsExpression: '"test/url".match(new RE2("test/ur", "")) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ "/test\\/ur/"',
        jsExpression: '"test/url".match(new RE2("test\\/ur", "")) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ /test/ur/',
        expectedErrSubStr: "Error attempting to evaluate the following rules:",
    },
    {
        rule: '"master" =~ /master$/',
        jsExpression: '"master".match(new RE2("master$", "")) != null',
        evalResult: true,
    },
    {
        rule: '"23" =~ "1234"',
        expectedErrSubStr: "must be a regex pattern. Do not rely on this behavior!",
    },
    {
        rule: '"23" =~ /1234/',
        jsExpression: '"23".match(new RE2("1234", "")) != null',
        evalResult: false,
    },
    {
        rule: '$CI_COMMIT_BRANCH && $GITLAB_FEATURES =~ /\bdependency_scanning\b/ && $CI_GITLAB_FIPS_MODE == "true"',
        jsExpression: 'null && false && null == "true"',
        evalResult: false,
    },
    {
        rule: '($CI_MERGE_REQUEST_SOURCE_BRANCH_NAME =~ /^perf_.*$/)',
        jsExpression: '(false)', // (null.match(new RE2("^perf_.*$", "")) != null => (false)
        evalResult: false,
    },
    {
        rule: '("qwerty" =~ /^perf_.*$/)',
        jsExpression: '("qwerty".match(new RE2("^perf_.*$", "")) != null)',
        evalResult: false,
    },
];
/* eslint-enable @typescript-eslint/quotes */

describe("gitlab rules regex", () => {
    tests.filter(t => !t.expectedErrSubStr)
        .forEach((t) => {
            test(`- if: '${t.rule}'\n\t => ${t.evalResult}`, async () => {
                const rules = [ {if: t.rule} ];
                const evalSpy = import.meta.jest.spyOn(global, "eval");
                const evaluateRuleIfSpy = import.meta.jest.spyOn(Utils, "evaluateRuleIf");

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
