import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-docker <consume artifacts> --needs", async () => {
    await fs.promises.rm("tests/test-cases/artifacts-docker/.gitlab-ci-local", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-docker",
        job: ["consume artifacts 🏗️"],
        needs: true,
        noColor: true,
    }, writeStreams);

    const expected = [
        "produce artifacts 📝  > CI_PROJECT_DIR=/builds/gcl/test-project",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    expect(fs.pathExistsSync("tests/test-cases/artifacts-docker/.gitlab-ci-local/artifacts/produceIAartifactsIPCfk50.c2393d2b/file2")).toBe(true);
    expect(fs.pathExistsSync("tests/test-cases/artifacts-docker/.gitlab-ci-local/artifacts/produceIAartifactsIPCfk50.c2393d2b/path/to/deep/folder/file3")).toBe(true);
});
