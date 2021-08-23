import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test.concurrent("cache <consume-cache> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache",
        job: ["consume-cache"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});

test.concurrent("cache <consume-cache-key-files> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/cache",
        job: ["consume-cache-key-files"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
