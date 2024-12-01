import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-no-shell-out <produce> --no-shell-isolation", async () => {
    await fs.promises.rm("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local/artifacts/produce/.gitlab-ci-local/artifacts/produce/path/file1", {force: true});

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-no-shell-out",
        job: ["produce"],
        shellIsolation: false,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local/artifacts/produce/path/file1")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local/artifacts/produce/path/file2")).toEqual(false);
    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local/artifacts/produce/.gitlab-ci-local/artifacts/produce/path/file1")).toEqual(false);
});
