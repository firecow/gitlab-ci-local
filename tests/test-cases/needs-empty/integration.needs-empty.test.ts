import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("needs-empty <deploy-job> --shell-isolation", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs-empty",
        job: ["deploy-job"],
        shellIsolation: true,
    }, writeStreams);

    expect(writeStreams.stderrLines).toEqual([]);
});
