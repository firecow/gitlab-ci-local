import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const test_job_1 = "test ${URL_${ENV}}";
test(`variable-expansion <${test_job_1}>`, async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-expansion",
        job: [test_job_1],
    }, writeStreams);

    const expected = chalk`{blueBright ${test_job_1}} {green $ echo $URL}
{blueBright ${test_job_1}} {greenBright >} url-dev`;

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});

const test_job_2 = "test ${${ENV}_URL}";
test(`variable-expansion <${test_job_2}>`, async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-expansion",
        job: [test_job_2],
    }, writeStreams);

    const expected = chalk`{blueBright ${test_job_2}} {green $ echo $URL}
{blueBright ${test_job_2}} {greenBright >} dev-url`;

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});

const test_job_3 = "docker-executor services variables with '";
test(`variable-expansion <${test_job_3}>`, async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-expansion",
        job: [test_job_3],
    }, writeStreams);

    const expected = chalk`{blueBright ${test_job_3}} {green $ echo $CI_JOB_NAME}
{blueBright ${test_job_3}} {greenBright >} ${test_job_3}`;

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});

const test_job_4 = "docker-executor variables with '";
test(`variable-expansion <${test_job_4}>`, async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-expansion",
        job: [test_job_4],
    }, writeStreams);

    const expected = chalk`{blueBright ${test_job_4}} {green $ echo $CI_JOB_NAME}
{blueBright ${test_job_4}} {greenBright >} ${test_job_4}`;

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});
