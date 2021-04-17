import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("manual <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/manual",
        manual: "build-job"
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Hello, build job manual!`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});
