import { MockWriteStreams } from "../../../src/mock-write-streams";
import { handler } from "../../../src/handler";

test("no-git-config", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/no-git-config",
    }, writeStreams);
    expect(writeStreams.stderrLines).toEqual([]);
    // Do we still need this test?
});
