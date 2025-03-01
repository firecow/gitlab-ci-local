import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("cli-option-variables <test-job> --variable \"CLI_VAR=hello world\"", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cli-option-variables",
        job: ["test-job"],
        variable: ["CLI_VAR=hello world", "CLI_VAR_DOT=dotdot", `CLI_MULTILINE=This is a multi
line string`],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} hello world`,
        chalk`{blueBright test-job} {greenBright >} dotdot`,
        chalk`{blueBright test-job} {greenBright >} This is a multi`,
        chalk`{blueBright test-job} {greenBright >} line string`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
