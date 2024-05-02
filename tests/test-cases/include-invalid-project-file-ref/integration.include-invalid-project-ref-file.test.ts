import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

test("include-invalid-project-file-ref", async () => {
    try {
        const spyGitRemote = {
            cmdArgs: ["bash", "-c", "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin"],
            returnValue: {stdout: "git@gitlab.com:gcl/test-hest.git"},
        };

        initSpawnSpy([...WhenStatics.all, spyGitRemote]);
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-invalid-project-file-ref",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");

        const msg = [
            "Project include could not be fetched { project: firecow/gitlab-ci-local-includes, ref: HEAD, file: .gitlab-modue.yml }",
        ];
        expect(e.message).toContain(msg.join("\n"));
    }
});
