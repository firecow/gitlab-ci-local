import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-shell-image-mix <consume> --needs --no-shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-shell-image-mix",
        job: ["consume"],
        needs: true,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-shell-image-mix/.gitlab-ci-local/artifacts/produce/path/file1")).toEqual(true);
    expect(await fs.pathExists("tests/test-cases/artifacts-shell-image-mix/.gitlab-ci-local/artifacts/produce/path/file2")).toEqual(false);
});
