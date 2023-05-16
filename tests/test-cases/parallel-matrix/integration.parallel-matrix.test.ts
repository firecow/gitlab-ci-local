import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("parallel-matrix <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
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

        chalk`{black.bgGreenBright  PASS } {blueBright pre-job           }`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job [foo]   }`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job [bar]   }`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job [beb]   }`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [foo,dev]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [foo,sta]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [foo,pro]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [bar,dev]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [bar,sta]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [bar,pro]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job [beb]    }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
