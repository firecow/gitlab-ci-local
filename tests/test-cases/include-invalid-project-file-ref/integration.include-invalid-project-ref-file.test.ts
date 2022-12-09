import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import assert, {AssertionError} from "assert";
import {initBashSpyReject, initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

test("include-invalid-project-file-ref", async () => {
    try {

        const target = ".gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/HEAD/";
        const spyGitArchive = {
            cmd: `git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git HEAD .gitlab-modue.yml | tar -f - -xC ${target}`,
            rejection: "Project include could not be fetched { project: firecow/gitlab-ci-local-includes, ref: HEAD, file: .gitlab-modue.yml }",
        };
        initBashSpyReject([spyGitArchive]);
        const spyGitRemote = {
            cmdArgs: ["git", "remote", "-v"],
            returnValue: {stdout: "origin\tgit@gitlab.com:gcl/test-hest.git (fetch)\norigin\tgit@gitlab.com:gcl/test-hest.git (push)\n"},
        };

        initSpawnSpy([...WhenStatics.all, spyGitRemote]);
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-invalid-project-file-ref",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe("Project include could not be fetched { project: firecow/gitlab-ci-local-includes, ref: HEAD, file: .gitlab-modue.yml }");
    }
});
