import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("needs-artifacts <test-job> --needs --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs-artifacts",
        job: ["test-job"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);
    expect(writeStreams.stderrLines).toEqual([]);
});
