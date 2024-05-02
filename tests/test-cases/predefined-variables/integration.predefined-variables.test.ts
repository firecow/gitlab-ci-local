import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

test("predefined-variables <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    const spyGitRemote = {
        cmdArgs: ["bash", "-c", "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin"],
        returnValue: {stdout: "git@gitlab.com:GCL/predefined-variables.git"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
    await handler({
        cwd: "tests/test-cases/predefined-variables",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} predefined-variables`,
        chalk`{blueBright test-job} {greenBright >} GCL/predefined-variables`,
        chalk`{blueBright test-job} {greenBright >} gcl-predefined-variables`,
        chalk`{blueBright test-job} {greenBright >} GCL`,
        chalk`{blueBright test-job} {greenBright >} ${process.cwd()}/tests/test-cases/predefined-variables`,
        chalk`{blueBright test-job} {greenBright >} main`,
        chalk`{blueBright test-job} {greenBright >} local-registry.gitlab.com/gcl/predefined-variables`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("predefined-variables <test-job> --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/predefined-variables",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} ${process.cwd()}/tests/test-cases/predefined-variables/.gitlab-ci-local/builds/test-job`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("predefined-variables CI_COMMIT_SHORT_SHA length", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/predefined-variables",
        job: ["test-job-commit-short-length"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job-commit-short-length}`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
