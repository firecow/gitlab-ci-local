import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("gitignore <test-job> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/gitignore",
        shellIsolation: true,
        needs: true,
    }, writeStreams);
});
