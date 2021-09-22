import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import {assert} from "../../../src/asserts";

test("include-invalid-project-file-ref", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/include-invalid-project-file-ref",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe("Project include could not be fetched { project: firecow/gitlab-ci-local-includes, ref: master, file: .gitlab-modue.yml }");
    }
});
