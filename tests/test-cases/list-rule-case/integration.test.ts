import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {vi} from "vitest";
import {GitData} from "../../../src/git-data.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("list-rule-case --list-rule single rule", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        stateDir: ".gitlab-ci-local-list-rule-case",
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage  when      }  {grey allow_failure  rule}`,
        chalk`{blueBright test-job }  Run Tests    {yellow test }  on_success  false      `,
        chalk`{blueBright build-job}               {yellow build}  on_success  true           {yellow 1 == 1}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("list-rule-case --list-rule verify that correct matching rule is displayed", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        file: ".gitlab-ci-match-correct-rule.yml",
        stateDir: ".gitlab-ci-match-correct-rule",
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage  when      }  {grey allow_failure  rule}`,
        chalk`{blueBright test-job }  Run Tests    {yellow test }  on_success  false      `,
        chalk`{blueBright build-job}               {yellow build}  on_success  true           {yellow 1 == 1}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("list-rule-case --list-rule verify that matching 'exists' rule is displayed", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        file: ".gitlab-ci-match-exists-rule.yml",
        stateDir: ".gitlab-ci-match-exists-rule",
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage  when      }  {grey allow_failure  rule}`,
        chalk`{blueBright test-job }  Run Tests    {yellow test }  on_success  false      `,
        chalk`{blueBright build-job}               {yellow build}  on_success  true           {yellow exists: [integration.test.ts, .gitlab-ci.yml]}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("list-rule-case --list-rule --evaluate-rule-changes verify that matching 'changes' rule is displayed", async () => {
    const writeStreams = new WriteStreamsMock();

    // Mock GitData.changedFiles to return files that match test case
    const gitDataSpy = vi.spyOn(GitData, "changedFiles");
    gitDataSpy.mockReturnValue([".gitlab-ci.yml"]);

    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        evaluateRuleChanges: true,
        file: ".gitlab-ci-match-changes-rule.yml",
        stateDir: ".gitlab-ci-match-changes-rule",
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage  when      }  {grey allow_failure  rule}`,
        chalk`{blueBright test-job }  Run Tests    {yellow test }  on_success  false      `,
        chalk`{blueBright build-job}               {yellow build}  on_success  true           {yellow changes: [.gitlab-ci.yml]}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    gitDataSpy.mockRestore();
});

test.concurrent("list-rule-case --list-rule verify that 'when' rule doesn't display", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        file: ".gitlab-ci-when-rule.yml",
        stateDir: ".gitlab-ci-when-rule",
    }, writeStreams);

    const expected = [
        chalk`{grey name       description}  {grey stage   when      }  {grey allow_failure  rule}`,
        chalk`{blueBright build-job}  Build        {yellow build }  on_success  false      `,
        chalk`{blueBright test-job }               {yellow test  }  on_failure  false      `,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("list-rule-case --list-rule verify that job combining 'if' and 'exists' displays properly", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        file: ".gitlab-ci-if-and-exists.yml",
        stateDir: ".gitlab-ci-if-and-exists",
    }, writeStreams);

    const expected = [
        chalk`{grey name                 description}  {grey stage   when      }  {grey allow_failure  rule}`,
        chalk`{blueBright docker-compose-up  }               {yellow deploy}  on_success  false      `,
        chalk`{blueBright docker-compose-down}               {yellow .post }  on_success  false          {yellow 1 == 1 && exists: [integration.test.ts]}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("list-rule-case --list-rule --evaluate-rule-changes verify that job combining 'if' and 'changes' displays properly", async () => {
    const writeStreams = new WriteStreamsMock();

    const gitDataSpy = vi.spyOn(GitData, "changedFiles");
    gitDataSpy.mockReturnValue(["example/fake-file.js", "other-file.txt", "one-more-file.json"]);

    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        evaluateRuleChanges: true,
        file: ".gitlab-ci-if-and-changes.yml",
        stateDir: ".gitlab-ci-if-and-changes",
    }, writeStreams);

    const expected = [
        chalk`{grey name          description}  {grey stage   when      }  {grey allow_failure  rule}`,
        chalk`{blueBright docker-build}               {yellow build }  on_success  false          {yellow 1 == 1 && changes: [example/*.js, other-file.txt]}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    gitDataSpy.mockRestore();

});

test("list-rule-case --list-rule --evaluate-rule-changes verify that if changes weren't made, rule doesn't display", async () => {
    const writeStreams = new WriteStreamsMock();

    const gitDataSpy = vi.spyOn(GitData, "changedFiles");
    gitDataSpy.mockReturnValue(["non-matching-file.js", "other-non-matching-file.txt"]);

    await handler({
        cwd: "tests/test-cases/list-rule-case/",
        listRule: true,
        evaluateRuleChanges: true,
        file: ".gitlab-ci-if-and-changes.yml",
        stateDir: ".gitlab-ci-if-and-changes",
    }, writeStreams);

    const expected = [
        chalk`{grey name          description}  {grey stage   when      }  {grey allow_failure  rule}`,
        chalk`{blueBright docker-build}               {yellow build }  on_success  false          {yellow 2 == 2}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    gitDataSpy.mockRestore();

});
