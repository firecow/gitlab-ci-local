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
        chalk`{black.bgRed  FAIL } {blueBright test-job                  }`,
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
        chalk`{black.bgYellowBright  WARN } {blueBright test-job-after-script     }  after_script`,
        chalk`{black.bgRed  FAIL } {blueBright test-job-after-script     }`,
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
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-job         }  pre_script`,
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
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-after-script}  pre_script`,
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-after-script}  after_script`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
