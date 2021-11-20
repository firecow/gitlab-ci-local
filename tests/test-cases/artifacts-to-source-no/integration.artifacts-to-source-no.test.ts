import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-to-source-no <produce> --needs --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-to-source-no",
        job: ["produce"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-to-source-no/path/file1")).toEqual(false);
    expect(writeStreams.stderrLines).toEqual([]);
});
