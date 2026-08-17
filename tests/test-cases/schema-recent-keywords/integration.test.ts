import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("schema accepts artifacts:access maintainer and artifacts:reports:sarif", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/schema-recent-keywords",
        noColor: true,
        list: true,
        stateDir: ".gitlab-ci-local-schema-recent-keywords",
    }, writeStreams);

    expect(writeStreams.stdoutLines.some(l => l.startsWith("job"))).toBe(true);
});
