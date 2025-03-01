import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("variable-order <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/variable-order",
        job: ["test-job"],
        variable: ["PROJECT_VARIABLE=project-value"],
        home: "tests/test-cases/variable-order/.home",
        noColor: true,
    }, writeStreams);

    const expected = `
test-job > PIPELINE_VARIABLE=pipeline-value
test-job > JOB_VARIABLE=job-value
test-job > OVERRIDDEN_BY_JOB=job-value
test-job > CI_PIPELINE_ID=pipeline-value
test-job > CI_JOB_ID=job-value
test-job > HOME_VARIABLE=home-value
test-job > PROJECT_VARIABLE=project-value
test-job > PROD_ONLY_VARIABLE=notprod
`.trim();

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("test-job >")).join("\n");
    expect(filteredStdout).toEqual(expected);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([" WARN  Avoid overriding predefined variables (​https://gitlab.com/gitlab-org/gitlab/-/blob/v17.7.1-ee/doc/ci/variables/predefined_variables.md?plain=1&ref_type=tags#L15-16​) [CI_PIPELINE_ID,CI_JOB_ID] as it can cause the pipeline to behave unexpectedly."]));
});
