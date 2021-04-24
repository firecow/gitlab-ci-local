import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("invalid-jobname", async () => {
    const writeStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/invalid-jobname",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe("Jobs cannot include spaces, yet! 'test job'");
    }
});
