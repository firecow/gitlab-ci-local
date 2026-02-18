import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("parallel <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        job: ["test-job"],
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-parallel-test-job",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright test-job: [1/2]} {greenBright >} 1/2`,
        chalk`{blueBright test-job: [2/2]} {greenBright >} 2/2`,
    ]));
});

test.concurrent("parallel 'test-job [1/2]'", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        job: ["test-job: [1/2]"],
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-parallel-test-job-1-2",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright test-job: [1/2]} {greenBright >} 1/2`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright test-job: [2/2]} {greenBright >} 2/2`,
    ]));
});

test.concurrent("parallel 'single-job'", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        job: ["single-job"],
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-parallel-single-job",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright single-job: [1/1]} {greenBright >} 1/1`,
    ]));
});
