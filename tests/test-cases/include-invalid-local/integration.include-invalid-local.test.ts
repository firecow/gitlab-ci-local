import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("include-invalid-local", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/include-invalid-local",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        expect(e.message).toBe("Local include file cannot be found .gitlab-ci-invalid.yml");
    }
});
