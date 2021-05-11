import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("trigger", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/trigger",
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright pipe-gen-job}`,
        chalk`{black.bgGreenBright  PASS } {blueBright trigger_job }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
