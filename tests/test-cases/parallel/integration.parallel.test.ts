import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";

test("parallel <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright test-job: [1/2]} {greenBright >} 1/2`,
        chalk`{blueBright test-job: [2/2]} {greenBright >} 2/2`,
    ]));
});

test("parallel 'test-job [1/2]'", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        job: ["test-job: [1/2]"],
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright test-job: [1/2]} {greenBright >} 1/2`,
    ]));

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright test-job: [2/2]} {greenBright >} 2/2`,
    ]));
});

test("parallel 'single-job'", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        job: ["single-job"],
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright single-job: [1/1]} {greenBright >} 1/1`,
    ]));
});
