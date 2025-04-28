import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-shell-fail <consume-cache> --shell-isolation --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-shell-fail",
        job: ["consume-cache"],
        needs: true,
        shellIsolation: true,
        noColor: true,
    }, writeStreams);

    const expected = [
        "WARNING: cache/**/*: no matching files. Ensure that the artifact path is relative to the working directory",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
