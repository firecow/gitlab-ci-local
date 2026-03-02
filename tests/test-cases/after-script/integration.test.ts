import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("after-script <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: ["test-job"],
        stateDir: ".gitlab-ci-local-after-script-test-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Cleanup after test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("after-script <build-job> (default)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: ["build-job"],
        stateDir: ".gitlab-ci-local-after-script-build-job-default",
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Cleanup after test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("after-script <deploy-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: ["deploy-job"],
        stateDir: ".gitlab-ci-local-after-script-deploy-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} running`,
        chalk`{blueBright deploy-job} {greenBright >} success`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("after-script <post-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: ["post-job"],
        stateDir: ".gitlab-ci-local-after-script-post-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright post-job} {greenBright >} failed`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
