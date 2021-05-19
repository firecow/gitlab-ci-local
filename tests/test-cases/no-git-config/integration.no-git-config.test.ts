import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("no-git-config", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/no-git-config",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        expect(e.message).toBe("Could not locate.gitconfig or .git/config file");
    }
});
