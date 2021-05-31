import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

jest.setTimeout(13000);

test("long-running-silent-build-job <build-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/long-running-silent-build-job",
        job: ["build-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines[4]).toEqual(chalk`{blueBright build-job} {greenBright >} 1`);
    expect(writeStreams.stdoutLines[7]).toEqual(chalk`{blueBright build-job} {greenBright >} 2`);
    expect(writeStreams.stdoutLines[10]).toEqual(chalk`{blueBright build-job} {greenBright >} 3`);
    expect(writeStreams.stdoutLines[13]).toEqual(chalk`{blueBright build-job} {greenBright >} 4`);
    expect(writeStreams.stdoutLines[16]).toEqual(chalk`{blueBright build-job} {greenBright >} 5`);
    expect(writeStreams.stdoutLines[19]).toEqual(chalk`{blueBright build-job} {greenBright >} 6`);
    expect(writeStreams.stdoutLines[22]).toEqual(chalk`{blueBright build-job} {greenBright >} 7`);
    expect(writeStreams.stdoutLines[25]).toEqual(chalk`{blueBright build-job} {greenBright >} 8`);
    expect(writeStreams.stdoutLines[28]).toEqual(chalk`{blueBright build-job} {greenBright >} 9`);
    expect(writeStreams.stdoutLines[31]).toEqual(chalk`{blueBright build-job} {greenBright >} 10`);
    expect(writeStreams.stdoutLines[34]).toEqual(chalk`{blueBright build-job} {greenBright >} 11`);
    expect(writeStreams.stderrLines).toEqual([]);
});
