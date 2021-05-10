import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

jest.setTimeout(13000);

test.concurrent("long-running-silent-test-job <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/long-running-silent-test-job",
        job: ["test-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines[5]).toEqual(chalk`{blueBright test-job} {grey > still running...}`);
    expect(writeStreams.stdoutLines[7]).toEqual(chalk`{blueBright test-job} {greenBright >} Test something`);
    expect(writeStreams.stderrLines).toEqual([]);
});
