import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("variable-null <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variables-null",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {green $ echo \"EMPTY_GLOBAL_VAR:\${EMPTY_GLOBAL_VAR\}\"}`,
        chalk`{blueBright test-job} {greenBright >} EMPTY_GLOBAL_VAR:`,
        chalk`{blueBright test-job} {green $ echo \"EMPTY_JOB_VAR:\${EMPTY_JOB_VAR\}\"}`,
        chalk`{blueBright test-job} {greenBright >} EMPTY_JOB_VAR:`,
    ];

    expect(writeStreams.stdoutLines.slice(1, -3)).toEqual(expected);
});
