import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("interactive <fake-shell-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/interactive",
        job: ["fake-shell-job"],
    }, writeStreams);
});
