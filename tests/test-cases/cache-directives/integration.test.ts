import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-directives <test-job> --shell-isolation --needs", async () => {
    await fs.rm("tests/test-cases/cache-directives/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-directives",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);

    await expect(fs.pathExists("tests/test-cases/cache-directives/.gitlab-ci-local/cache/default/cache/file1.txt")).resolves.toBe(true);
});
