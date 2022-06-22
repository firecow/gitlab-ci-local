import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-directives <test-job> --shell-isolation --needs", async () => {
    await fs.rm("tests/test-cases/cache-directives/.gitlab-ci-local/cache/", {recursive: true, force:true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-directives",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams);

    await expect(fs.pathExists("tests/test-cases/cache-directives/.gitlab-ci-local/cache/default/cache/file1.txt")).resolves.toBe(true);
});
