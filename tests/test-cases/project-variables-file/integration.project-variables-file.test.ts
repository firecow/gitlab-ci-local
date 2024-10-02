import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy([...WhenStatics.all]);
});

test.concurrent("project-variables-file <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/project-variables-file",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Y`,
        chalk`{blueBright test-job} {greenBright >} Recursive CI/CD`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file <issue-1333>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/project-variables-file",
        file: ".gitlab-ci-issue-1333.yml",
    }, writeStreams);

    const expected = [
        chalk`{blueBright issue-1333} {greenBright >} firecow`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file custom-path", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/project-variables-file",
        file: ".gitlab-ci-custom.yml",
        variablesFile: ".custom-local-var-file",
    }, writeStreams);

    const expected = [
        chalk`{blueBright job} {greenBright >} firecow`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
