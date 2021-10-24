import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("cli-option-variables <test-job> --variable \"CLI_VAR=hello world\"", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cli-option-variables",
        job: ["test-job"],
        variable: ["CLI_VAR=hello world", "CLI_VAR_DOT=dotdot"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} hello world`,
        chalk`{blueBright test-job} {greenBright >} dotdot`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
