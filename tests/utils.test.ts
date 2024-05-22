import {GitData} from "../src/git-data";
import {Utils} from "../src/utils";
import {initBashSpyReject, initBashSpy} from "./mocks/utils.mock";

import {isSshDirFound} from "./utils";

test("remoteFileExist protocol: git", async () => {
    const file = "templates/test.yml";
    const ref = "0.3.1";
    const domain = "gitlab.com";
    const projectPath = "components/go";

    // NOTE: Only mocks git archive command if `~/.ssh` ssh dir is not found
    if (!isSshDirFound()) {
        const spyGitArchive = {
            cmd: `git archive --remote=ssh://git@${domain}/${projectPath}.git ${ref} ${file} > /dev/null`,
            returnValue: {output: ""},
        };
        initBashSpy([spyGitArchive]);
    }

    const fileExist = await Utils.remoteFileExist(file, ref, domain, projectPath, "git");
    expect(fileExist).toBe(true);
});

test("remoteFileDoesNotExist protocol: git", async () => {
    const file = "templates/potato.yml";
    const ref = "0.3.1";
    const domain = "gitlab.com";
    const projectPath = "components/go";

    // NOTE: Only mocks git archive command if `~/.ssh` ssh dir is not found
    if (!isSshDirFound()) {
        const spyGitArchive = {
            cmd: `git archive --remote=ssh://git@${domain}/${projectPath}.git ${ref} ${file} > /dev/null`,
            rejection: {
                stderr: `fatal: sent error to the client: git upload-archive: archiver died with error
remote: fatal: pathspec 'templates/potato.yml' did not match any files
remote: git upload-archive: archiver died with error`,
            },
        };
        initBashSpyReject([spyGitArchive]);
    }
    const fileExist = await Utils.remoteFileExist(file, ref, domain, projectPath, "git");
    expect(fileExist).toBe(false);
});

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
            const spy = jest.spyOn(GitData, "changedFiles");
            spy.mockReturnValue(t.input);
            expect(Utils.evaluateRuleChanges("origin/master", t.pattern)).toBe(t.hasChanges);
        });
    });
});
