import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

// workflow:rules:variables should be applied as global variables when a rule matches
test.concurrent("workflow-rules-variables are applied", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/workflow-rules-variables",
        stateDir: ".gitlab-ci-local-workflow-rules-variables",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("WORKFLOW_VAR=from-workflow-rules");
});

test.concurrent("workflow-rules-variables not applied when rule does not match", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/workflow-rules-variables",
        file: ".gitlab-ci-no-match.yml",
        stateDir: ".gitlab-ci-local-workflow-rules-variables-no-match",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).not.toContain("WORKFLOW_VAR=from-workflow-rules");
});

test.concurrent("workflow-rules:if with null RHS regex variable does not throw", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/workflow-rules-variables",
        file: ".gitlab-ci-null-rhs-regex.yml",
        stateDir: ".gitlab-ci-local-workflow-rules-variables-null-rhs-regex",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("job ran");
});

test.concurrent("workflow-rules-variables overridden by job variables", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/workflow-rules-variables",
        file: ".gitlab-ci-job-override.yml",
        stateDir: ".gitlab-ci-local-workflow-rules-variables-job-override",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("WORKFLOW_VAR=from-job");
});
