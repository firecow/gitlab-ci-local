import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

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

    const expected = [
        chalk`{blueBright ${test_job_1}} {green $ echo $URL}`,
        chalk`{blueBright ${test_job_1}} {greenBright >} url-dev`,
    ];

    expect(writeStreams.stdoutLines.slice(1, -3)).toEqual(expected);
});

const test_job_2 = "test ${${ENV}_URL}";
test(`variable-expansion <${test_job_2}>`, async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-expansion",
        job: [test_job_2],
    }, writeStreams);

    const expected = [
        chalk`{blueBright ${test_job_2}} {green $ echo $URL}`,
        chalk`{blueBright ${test_job_2}} {greenBright >} dev-url`,
    ];

    expect(writeStreams.stdoutLines.slice(1, -3)).toEqual(expected);
});
