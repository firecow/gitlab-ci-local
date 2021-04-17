import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";

test("include-invalid-project-file-ref", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/include-invalid-project-file-ref",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe("Project include could not be fetched { project: firecow/gitlab-ci-local-includes, ref: master, file: .gitlab-modue.yml }");
    }
});
