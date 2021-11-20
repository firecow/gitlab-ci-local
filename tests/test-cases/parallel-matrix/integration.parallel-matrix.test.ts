import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("parallel-matrix <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/parallel-matrix",
        jobs: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job[foo]   } {greenBright >} NAME:'foo' 1/3`,
        chalk`{blueBright build-job[bar]   } {greenBright >} NAME:'bar' 2/3`,
        chalk`{blueBright build-job[bear]  } {greenBright >} NAME:'bear' 3/3`,

        chalk`{blueBright test-job[foo,hey]} {greenBright >} NAME:'foo' SPIFFY:'hey' 1/7`,
        chalk`{blueBright test-job[foo,dar]} {greenBright >} NAME:'foo' SPIFFY:'dar' 2/7`,
        chalk`{blueBright test-job[foo,dun]} {greenBright >} NAME:'foo' SPIFFY:'dun' 3/7`,
        chalk`{blueBright test-job[bar,hey]} {greenBright >} NAME:'bar' SPIFFY:'hey' 4/7`,
        chalk`{blueBright test-job[bar,dar]} {greenBright >} NAME:'bar' SPIFFY:'dar' 5/7`,
        chalk`{blueBright test-job[bar,dun]} {greenBright >} NAME:'bar' SPIFFY:'dun' 6/7`,
        chalk`{blueBright test-job[bear]   } {greenBright >} NAME:'bear' SPIFFY:'' 7/7`,

    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toEqual(0);
});
