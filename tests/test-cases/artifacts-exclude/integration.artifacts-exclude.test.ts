import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("artifacts-exclude <consume-artifacts> --needs --exclude", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-exclude",
        job: ["consume-artifacts"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
