import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-no-shell-out <produce> --no-shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-no-shell-out",
        job: ["produce"],
        shellIsolation: false,
        stateDir: ".gitlab-ci-local-artifacts-no-shell-out",
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local-artifacts-no-shell-out/artifacts/produce/path/file1")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local-artifacts-no-shell-out/artifacts/produce/path/file2")).toEqual(false);
    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local-artifacts-no-shell-out/artifacts/produce/.gitlab-ci-local-artifacts-no-shell-out/artifacts/produce/path/file1")).toEqual(false);
});
