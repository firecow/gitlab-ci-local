import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("cache-docker-owners <consume-caches> restores the cache with the uid/gid it was saved with", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-cache-docker-owners";
    const cwd = "tests/test-cases/cache-docker-owners";
    await fs.rm(`${cwd}/${stateDir}`, {recursive: true, force: true});

    await handler({
        cwd,
        noColor: true,
        file: ".gitlab-ci.yml",
        stateDir,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain("PASS  consume-caches");
});
