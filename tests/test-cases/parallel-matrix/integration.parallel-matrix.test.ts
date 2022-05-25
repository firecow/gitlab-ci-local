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
        chalk`{blueBright build-job [foo]   } {greenBright >} NAME:'foo' 1/3`,
        chalk`{blueBright build-job [bar]   } {greenBright >} NAME:'bar' 2/3`,
        chalk`{blueBright build-job [beb]   } {greenBright >} NAME:'beb' 3/3`,

        chalk`{blueBright test-job [foo,dev]} {greenBright >} NAME:'foo' TIER:'dev' 1/7`,
        chalk`{blueBright test-job [foo,sta]} {greenBright >} NAME:'foo' TIER:'sta' 2/7`,
        chalk`{blueBright test-job [foo,pro]} {greenBright >} NAME:'foo' TIER:'pro' 3/7`,
        chalk`{blueBright test-job [bar,dev]} {greenBright >} NAME:'bar' TIER:'dev' 4/7`,
        chalk`{blueBright test-job [bar,sta]} {greenBright >} NAME:'bar' TIER:'sta' 5/7`,
        chalk`{blueBright test-job [bar,pro]} {greenBright >} NAME:'bar' TIER:'pro' 6/7`,
        chalk`{blueBright test-job [beb]    } {greenBright >} NAME:'beb' TIER:'' 7/7`,

    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
