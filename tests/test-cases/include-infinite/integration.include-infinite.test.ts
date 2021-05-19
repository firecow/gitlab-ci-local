import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("include-infinite", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/include-infinite",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        expect(e.message).toBe("circular dependency detected in `include`");
    }
});
