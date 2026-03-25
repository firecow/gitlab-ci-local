import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-docker-readonly-permissions should successfully export artifacts with read-only directories", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-docker-readonly-permissions",
        noColor: true,
        file: ".gitlab-ci.yml",
        stateDir: ".gitlab-ci-local-artifacts-docker-readonly-permissions",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain("produce-artifacts exported artifacts");
});
