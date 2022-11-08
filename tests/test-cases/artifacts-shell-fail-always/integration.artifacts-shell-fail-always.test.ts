import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-shell-fail-always <consume> --needs --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-shell-fail-always",
        job: ["consume"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-shell-fail-always/path/file1")).toEqual(true);
});
