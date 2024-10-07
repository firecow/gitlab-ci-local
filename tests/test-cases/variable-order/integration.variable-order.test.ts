import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("variable-order <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-order",
        job: ["test-job"],
        variable: ["PROJECT_VARIABLE=project-value"],
        home: `${process.cwd()}/tests/test-cases/variable-order/.home/.gitlab-ci-local`,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} PIPELINE_VARIABLE=pipeline-value`,
        chalk`{blueBright test-job} {greenBright >} JOB_VARIABLE=job-value`,
        chalk`{blueBright test-job} {greenBright >} OVERRIDDEN_BY_JOB=job-value`,
        chalk`{blueBright test-job} {greenBright >} CI_PIPELINE_ID=1000`,
        chalk`{blueBright test-job} {greenBright >} HOME_VARIABLE=home-value`,
        chalk`{blueBright test-job} {greenBright >} PROJECT_VARIABLE=project-value`,
        chalk`{blueBright test-job} {greenBright >} PROD_ONLY_VARIABLE=notprod`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
