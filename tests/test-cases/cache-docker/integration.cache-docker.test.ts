import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-docker <consume-cache> --needs", async () => {
    await fs.rm("tests/test-cases/cache-docker/.gitlab-ci-local/cache/", {recursive: true, force:true});
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache-docker",
        job: ["consume-cache"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
