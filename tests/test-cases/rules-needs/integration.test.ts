import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("rules-needs - default branch uses rule needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/rules-needs",
        variable: ["CI_COMMIT_BRANCH=main"],
        stateDir: ".gitlab-ci-local-rules-needs-default-branch-uses-rule-needs",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("test-job");
    expect(output).not.toContain("build-dev started");
});

test.concurrent("rules-needs - non-default branch uses job-level needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/rules-needs",
        variable: ["CI_COMMIT_BRANCH=feature"],
        stateDir: ".gitlab-ci-local-rules-needs-non-default-branch-uses-job-level-need",
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("test-job");
    expect(output).toContain("build-dev");
});
