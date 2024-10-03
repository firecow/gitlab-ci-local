
import {Utils} from "../src/utils";
import {GitData} from "../src/git-data";
import {WriteStreamsMock} from "../src/write-streams";

let writeStreams;
let gitData: GitData;
//
beforeEach(async () => {
    writeStreams = new WriteStreamsMock();
    gitData = await GitData.init("tests", writeStreams);
    jest.clearAllMocks();
});

/* eslint-disable @typescript-eslint/quotes */
const tests = [
    {
        rule: '"foo" !~ /foo/',
        jsExpression: '"foo".match(/foo/) == null',
        evalResult: false,
    },
    {
        rule: '"foo" =~ /foo/',
        jsExpression: '"foo".match(/foo/) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~ /foo/',
        jsExpression: '"foo".match(/foo/) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~/foo/',
        jsExpression: '"foo".match(/foo/) != null',
        evalResult: true,
    },
    {
        rule: '"foo"=~  /foo/',
        jsExpression: '"foo".match(/foo/) != null',
        evalResult: true,
    },
    {
        rule: '"foo" =~ "/foo/"',
        jsExpression: '"foo".match(new RegExp(/foo/)) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ "/test/ur/"',
        jsExpression: '"test/url".match(new RegExp(/test\\/ur/)) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ "/test\\/ur/"',
        jsExpression: '"test/url".match(new RegExp(/test\\/ur/)) != null',
        evalResult: true,
    },
    {
        rule: '"test/url" =~ /test/ur/',
        expectErr: true,
    },
    {
        rule: '"master" =~ /master$/',
        jsExpression: '"master".match(/master$/) != null',
        evalResult: true,
    },
    {
        rule: '"23" =~ "1234"',
        expectErr: true,
    },
    {
        rule: '"23" =~ /1234/',
        jsExpression: '"23".match(/1234/) != null',
        evalResult: false,
    },
    {
        rule: '$CI_COMMIT_BRANCH && $GITLAB_FEATURES =~ /\bdependency_scanning\b/ && $CI_GITLAB_FIPS_MODE == "true"',
        jsExpression: 'null && false && null == "true"',
        evalResult: false,
    },
];
/* eslint-enable @typescript-eslint/quotes */

describe("gitlab rules regex", () => {
    tests.filter(t => !t.expectErr)
        .forEach((t) => {
            test(`- if: '${t.rule}'\n\t => ${t.evalResult}`, async () => {
                const rules = [ {if: t.rule} ];
                const evalSpy = jest.spyOn(global, "eval");
                const evaluateRuleIfSpy = jest.spyOn(Utils, "evaluateRuleIf");

                Utils.getRulesResult({cwd: "", rules, variables: {}}, gitData);
                expect(evalSpy).toHaveBeenCalledWith(t.jsExpression);
                expect(evaluateRuleIfSpy).toHaveReturnedWith(t.evalResult);
            });
        });
});

describe("gitlab rules regex [invalid]", () => {
    tests.filter(t => t.expectErr)
        .forEach((t) => {
            test(`- if: '${t.rule}'\n\t => error`, async () => {
                const rules = [ {if: t.rule} ];

                try {
                    Utils.getRulesResult({cwd: "", rules, variables: {}}, gitData);
                } catch (e) {
                    return;
                }

                throw new Error("Error is expected but not thrown/caught");
            });
        });
});
