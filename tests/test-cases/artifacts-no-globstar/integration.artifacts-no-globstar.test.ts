import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("artifacts-no-globstar", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/artifacts-no-globstar",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe("Artfact paths cannot contain globstar, yet! 'test-job'");
    }
});
