import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("custom-home <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/custom-home",
        job: "test-job",
        home: "tests/test-cases/custom-home/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} group-global-var-override-value`,
        chalk`{blueBright test-job} {greenBright >} project-group-var-override-value`,
        chalk`{blueBright test-job} {greenBright >} project-var-value`,
        chalk`{blueBright test-job} {greenBright >} Im content of a file variable`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
