import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

jest.setTimeout(13000);

test("long-running-silent-build-job <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/long-running-silent-build-job",
        job: ["build-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines[6]).toEqual(chalk`{blueBright build-job} {greenBright >} 1`);
    expect(writeStreams.stdoutLines[9]).toEqual(chalk`{blueBright build-job} {greenBright >} 2`);
    expect(writeStreams.stdoutLines[12]).toEqual(chalk`{blueBright build-job} {greenBright >} 3`);
    expect(writeStreams.stdoutLines[15]).toEqual(chalk`{blueBright build-job} {greenBright >} 4`);
    expect(writeStreams.stdoutLines[18]).toEqual(chalk`{blueBright build-job} {greenBright >} 5`);
    expect(writeStreams.stdoutLines[21]).toEqual(chalk`{blueBright build-job} {greenBright >} 6`);
    expect(writeStreams.stdoutLines[24]).toEqual(chalk`{blueBright build-job} {greenBright >} 7`);
    expect(writeStreams.stdoutLines[27]).toEqual(chalk`{blueBright build-job} {greenBright >} 8`);
    expect(writeStreams.stdoutLines[30]).toEqual(chalk`{blueBright build-job} {greenBright >} 9`);
    expect(writeStreams.stdoutLines[33]).toEqual(chalk`{blueBright build-job} {greenBright >} 10`);
    expect(writeStreams.stdoutLines[36]).toEqual(chalk`{blueBright build-job} {greenBright >} 11`);
    expect(writeStreams.stderrLines).toEqual([]);
});
