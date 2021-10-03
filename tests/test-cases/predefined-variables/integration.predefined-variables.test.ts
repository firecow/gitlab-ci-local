import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("predefined-variables <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/predefined-variables",
        job: ["test-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines[3]).toEqual(chalk`{blueBright test-job} {greenBright >} predefined-variables`);
    expect(writeStreams.stdoutLines[5]).toEqual(chalk`{blueBright test-job} {greenBright >} gcl-predefined-variables`);
    expect(writeStreams.stdoutLines[7]).toEqual(chalk`{blueBright test-job} {greenBright >} gcl`);
    expect(writeStreams.stdoutLines[9]).toEqual(chalk`{blueBright test-job} {greenBright >} tests/test-cases/predefined-variables`);
    expect(writeStreams.stderrLines).toEqual([]);
});

test("predefined-variables <test-job> --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/predefined-variables",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines[9]).toEqual(chalk`{blueBright test-job} {greenBright >} tests/test-cases/predefined-variables/.gitlab-ci-local/builds/test-job`);
    expect(writeStreams.stderrLines).toEqual([]);
});
