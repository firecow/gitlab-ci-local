import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("parallel <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/parallel",
        jobs: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job [1]} {greenBright >} NODE 1/3`,
        chalk`{blueBright build-job [2]} {greenBright >} NODE 2/3`,
        chalk`{blueBright build-job [3]} {greenBright >} NODE 3/3`,
        chalk`{black.bgGreenBright  PASS } {blueBright pre-job      }`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job [1]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job [2]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright build-job [3]}`,
        chalk`{black.bgGreenBright  PASS } {blueBright test-job     }`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
