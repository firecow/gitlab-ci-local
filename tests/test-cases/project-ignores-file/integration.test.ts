import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";

const cwd = "tests/test-cases/project-ignores-file";
const ignoresFile = "gitlab-ci-local-ignores-test-job";

test.concurrent("project-no-ignores-file", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-no-ignores-file";
    await handler({
        cwd,
        job: ["test-job"],
        noColor: true,
        stateDir,
        variable: [`STATE_DIR=${stateDir}`],
    }, writeStreams);
    const expected = ["test-job > 2"];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-ignores-file", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-ignores-file";
    await handler({
        cwd,
        job: ["test-job"],
        ignoresFile,
        noColor: true,
        stateDir,
        variable: [`STATE_DIR=${stateDir}`],
    }, writeStreams);
    const expected = ["test-job > 1"];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
