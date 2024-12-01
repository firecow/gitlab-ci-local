import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-docker <consume-cache> --needs", async () => {
    await fs.rm("tests/test-cases/cache-docker/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-docker",
        job: ["consume-cache"],
        needs: true,
    }, writeStreams);
    expect(writeStreams.stdoutLines.join("\n")).toEqual(expect.stringMatching(/exported cache .cache 'maven'/));
});
