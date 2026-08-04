import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy([...WhenStatics.all, WhenStatics.mockGitRemoteHttp]);
});

test.concurrent("include:project with a wildcard file path includes every match", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/include-project-file-wildcard",
        noColor: true,
        list: true,
        stateDir: ".gitlab-ci-local-include-project-file-wildcard",
    }, writeStreams);

    const jobNames = writeStreams.stdoutLines
        .filter(l => /^(build|test)\s/.test(l))
        .map(l => l.split(/\s+/)[0])
        .sort();

    expect(jobNames).toEqual(["build", "test"]);
});
