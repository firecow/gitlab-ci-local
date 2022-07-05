import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-no-shell-out <produce> --no-shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-no-shell-out",
        job: ["produce"],
        shellIsolation: false,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local/artifacts/produce/path/file1")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/artifacts-no-shell-out/.gitlab-ci-local/artifacts/produce/path/file2")).toEqual(false);
});
