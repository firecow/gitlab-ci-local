import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("include-template <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/include-template",
        job: "test-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});
