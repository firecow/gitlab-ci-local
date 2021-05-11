import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("after-script <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job } {greenBright >} Cleanup after test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});

test("after-script <build-job> (default)", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/after-script",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Cleanup after test`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
