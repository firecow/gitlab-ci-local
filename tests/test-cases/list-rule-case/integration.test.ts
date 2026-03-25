import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("list-rule-case --list-rule", async () => {
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
    console.log(writeStreams.stdoutLines)
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
    console.log(writeStreams.stdoutLines)
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});