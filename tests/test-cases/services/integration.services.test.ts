import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test.concurrent("services <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgRed  FAIL } {blueBright test-job  }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright build-job }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("services <deploy-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/services",
        job: ["deploy-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright deploy-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
