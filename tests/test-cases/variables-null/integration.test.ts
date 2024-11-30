import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("variable-null <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variables-null",
        job: ["test-job"],
    }, writeStreams);

    const expected = chalk`
{blueBright test-job} {green $ echo \"EMPTY_GLOBAL_VAR:\${EMPTY_GLOBAL_VAR\}\"}
{blueBright test-job} {greenBright >} EMPTY_GLOBAL_VAR:
{blueBright test-job} {green $ echo \"EMPTY_JOB_VAR:\${EMPTY_JOB_VAR\}\"}
{blueBright test-job} {greenBright >} EMPTY_JOB_VAR:`;

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});
