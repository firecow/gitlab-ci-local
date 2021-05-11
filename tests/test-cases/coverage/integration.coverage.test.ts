import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("coverage <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/coverage",
        job: ["test-job"],
    }, writeStreams);

    const expected = [chalk`{black.bgGreenBright  PASS } {blueBright test-job} 78.46% {gray coverage}`];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
