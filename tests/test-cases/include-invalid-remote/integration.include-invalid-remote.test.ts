import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("include-invalid-remote", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/include-invalid-remote",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        expect(e.message).toBe("Remote include could not be fetched https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.itlab-http.yml");
    }
});
