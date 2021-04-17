import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("script-failures <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "test-job",
    }, writeStreams);

    const expected = [
        chalk`{red failure} {blueBright test-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <test-job-after-script>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "test-job-after-script",
    }, writeStreams);

    const expected = [
        chalk`{yellowBright after script} {blueBright test-job-after-script}`,
        chalk`{red failure} {blueBright test-job-after-script}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <allow-failure-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "allow-failure-job",
    }, writeStreams);

    const expected = [
        chalk`{yellowBright warning} {blueBright allow-failure-job}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <allow-failure-after-scripts>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: "allow-failure-after-script",
    }, writeStreams);

    const expected = [
        chalk`{yellowBright warning} {blueBright allow-failure-after-script}`,
        chalk`{yellowBright after script} {blueBright allow-failure-after-script}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
