import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import {assert} from "../../../src/asserts";

test("include-invalid-remote", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/include-invalid-remote",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe("Remote include could not be fetched https://gitlab.com/firecow/gitlab-ci-local-includes/-/raw/master/.itlab-http.yml");
    }
});
