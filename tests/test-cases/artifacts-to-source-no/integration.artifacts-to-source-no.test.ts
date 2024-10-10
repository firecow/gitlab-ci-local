import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("artifacts-to-source-no <produce> --needs --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-to-source-no",
        job: ["produce"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-to-source-no/path/file-descriptor")).toEqual(false);
});

test.concurrent("artifacts-to-source-no <produce-global> --needs --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-to-source-no",
        job: ["produce-global"],
        needs: true,
        shellIsolation: true,
        artifactsToSource: false,
    }, writeStreams);

    expect(await fs.pathExists("tests/test-cases/artifacts-to-source-no/path/file-global")).toEqual(false);
});
