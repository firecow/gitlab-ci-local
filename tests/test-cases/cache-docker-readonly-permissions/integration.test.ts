import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-docker-readonly-permissions should successfully export cache with read-only directories", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-cache-docker-readonly-permissions";
    await handler({
        cwd: "tests/test-cases/cache-docker-readonly-permissions",
        noColor: true,
        file: ".gitlab-ci.yml",
        stateDir,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(`produce-cache cache created in '${stateDir}/cache/default'`);
});
