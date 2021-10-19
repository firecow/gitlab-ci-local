import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test.concurrent("artifacts-to-source-no <produce> --needs --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-to-source-no",
        job: ["consume"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);
    expect(writeStreams.stderrLines).toEqual([]);
});
