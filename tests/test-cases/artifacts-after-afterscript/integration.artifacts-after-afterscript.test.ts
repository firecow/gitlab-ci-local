import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("after-script <artifact-job>: after scripts are executed before uploading artifacts", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-after-afterscript",
        job: ["artifact-job"],
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-after-afterscript/.gitlab-ci-local/artifacts/artifact-job/logs/foo.log")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/artifacts-after-afterscript/.gitlab-ci-local/artifacts/artifact-job/logs/foo.badlog")).toEqual(false);
    await fs.promises.rm("tests/test-cases/after-script/logs", {force: true, recursive: true});
});
