import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("artifacts-docker <consume artifacts> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/artifacts-docker",
        job: ["consume artifacts 🏗️"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
