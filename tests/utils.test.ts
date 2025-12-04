import {GitData} from "../src/git-data.js";
import {Utils} from "../src/utils.js";

describe("evaluateRuleChanges", () => {
    const tests = [
        {
            description: "should be case sensitive",
            input: ["Foo"],
            pattern: ["foo"],
            hasChanges: false,
        },
        {
            description: "should support wildcard",
            input: ["foo"],
            pattern: ["*"],
            hasChanges: true,
        },
        {
            description: "should support wildcard glob",
            input: ["README.md"],
            pattern: ["*.md"],
            hasChanges: true,
        },
        {
            description: "should support globstar",
            input: ["aaa/bc/foo"],
            pattern: ["**/foo"],
            hasChanges: true,
        },
        {
            description: "should support brace expansion",
            input: ["src/foo.rb"],
            pattern: ["src/*.{rb,py,sh}"],
            hasChanges: true,
        },
        {
            description: "should not support negation",
            input: ["README.md"],
            pattern: ["!.*"],
            hasChanges: false,
        },
        {
            description: "should not support extended glob",
            input: ["a.js"],
            pattern: ["+(a|b).js"],
            hasChanges: false,
        },
        {
            description: "should treat . as literal (false)",
            input: ["fizz"],
            pattern: ["...."],
            hasChanges: false,
        },
        {
            description: "should treat . as literal (true)",
            input: ["...."],
            pattern: ["...."],
            hasChanges: true,
        },
        {
            description: "should not support posix character class",
            input: ["a"],
            pattern: ["[[:alpha:]]"],
            hasChanges: false,
        },
        {
            description: "wildcard should match filename starting with '.'",
            input: [".profile"],
            pattern: ["*"],
            hasChanges: true,
        },

        {
            description: "should match entire string",
            input: ["cat"],
            pattern: ["cat"],
            hasChanges: true,
        },
        {
            description: "should not match partial string",
            input: ["category"],
            pattern: ["cat"],
            hasChanges: false,
        },
        {
            description: "should support FNM_EXTGLOB",
            input: ["cats"],
            pattern: ["c{at,ub}s"],
            hasChanges: true,
        },
        {
            description: "'?' should match only one character (truthy)",
            input: ["cat"],
            pattern: ["c?t"],
            hasChanges: true,
        },
        {
            description: "'?' should match only one character (falsy)",
            input: ["cat"],
            pattern: ["c??t"],
            hasChanges: false,
        },
        {
            description: "'*' should match 0 or more characters",
            input: ["cats"],
            pattern: ["c*"],
            hasChanges: true,
        },
        {
            description: "should support inclusive bracket expansion",
            input: ["cat"],
            pattern: ["ca[a-z]"],
            hasChanges: true,
        },
        {
            description: "should support exclusive bracket expansion (falsy)",
            input: ["cat"],
            pattern: ["ca[^t]"],
            hasChanges: false,
        },
        {
            description: "should support exclusive bracket expansion (truthy)",
            input: ["caa"],
            pattern: ["ca[^t]"],
            hasChanges: true,
        },
    ];
    tests.forEach((t) => {
        test.concurrent(`${t.description} \t\t [input: ${t.input} pattern: ${t.pattern} hasChanges: ${t.hasChanges}]`, () => {
            const spy = import.meta.jest.spyOn(GitData, "changedFiles");
            spy.mockReturnValue(t.input);
            expect(Utils.evaluateRuleChanges("origin/master", t.pattern, ".")).toBe(t.hasChanges);
        });
    });
});

describe("isSubPath where process.cwd() have been mocked to return /home/user/gitlab-ci-local", () => {
    beforeAll(() => {
        const spy = import.meta.jest.spyOn(process, "cwd");
        spy.mockReturnValue("/home/user/gitlab-ci-local");
    });

    const tests: {
        input: [string, string, string?];
        expected: boolean;
    }[] = [
        {
            input: ["/tmp", "foo"],
            expected: false,
        },
        {
            input: ["../bar", "foo"],
            expected: false,
        },
        {
            input: ["../gitlab-ci-local", "."],
            expected: true,
        },
        {
            input: ["../gitlab-ci-local", "/home/user/gitlab-ci-local"],
            expected: true,
        },
        {
            input: ["../gitlab-ci-local", "/gitlab-ci-local"],
            expected: false,
        },
        {
            input: ["../////gitlab-ci-local", "."],
            expected: true,
        },
        {
            input: ["cache/*/foo", "cache"],
            expected: true,
        },
        {
            input: ["cache", "cache/*/foo"],
            expected: false,
        },
        {
            input: ["key-files", "/home/user/gitlab-ci-local", "/home/user/gitlab-ci-local"],
            expected: true,
        },
    ];
    tests.forEach(({input, expected}) => {
        test(`isSubpath("${input[0]}", "${input[1]}") => ${expected}`, () => {
            expect(Utils.isSubpath(...input)).toBe(expected);
        });
    });
});
