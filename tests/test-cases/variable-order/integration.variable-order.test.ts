import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("variable-order <test-job> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/variable-order",
        job: ["test-job"],
        variable: ["PROJECT_VARIABLE=project-value"],
        home: "tests/test-cases/variable-order/.home",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} PIPELINE_VARIABLE=pipeline-value`,
        chalk`{blueBright test-job} {greenBright >} JOB_VARIABLE=job-value`,
        chalk`{blueBright test-job} {greenBright >} OVERRIDDEN_BY_JOB=job-value`,
        chalk`{blueBright test-job} {greenBright >} CI_PIPELINE_ID=pipeline-value`,
        chalk`{blueBright test-job} {greenBright >} HOME_VARIABLE=home-value`,
        chalk`{blueBright test-job} {greenBright >} PROJECT_VARIABLE=project-value`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
