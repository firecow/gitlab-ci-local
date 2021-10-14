import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("parallel-matrix <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/parallel-matrix",
        jobs: ["test-job"],
    }, writeStreams);

    expect(writeStreams.stderrLines.length).toEqual(0);
});
