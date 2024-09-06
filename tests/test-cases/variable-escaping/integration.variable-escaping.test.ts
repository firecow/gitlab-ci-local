import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const test_job_1 = "test $ character in CI/CD variable";
test(`variable-escaping <${test_job_1}>`, async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-escaping",
        job: [test_job_1],
    }, writeStreams);

    const expected = chalk`
{blueBright ${test_job_1}} {green $ echo "$LS_CMD"}
{blueBright ${test_job_1}} {greenBright >} ls "-al" $TMP_DIR`;

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});
