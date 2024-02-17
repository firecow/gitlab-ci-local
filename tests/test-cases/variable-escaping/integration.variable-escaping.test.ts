import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

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

    const expected = [
        chalk`{blueBright ${test_job_1}} {green $ echo "$LS_CMD"}`,
        chalk`{blueBright ${test_job_1}} {greenBright >} ls "-al" $TMP_DIR`,
    ];

    expect(writeStreams.stdoutLines.slice(1, -3)).toEqual(expected);
});
