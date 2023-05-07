import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import assert, {AssertionError} from "assert";
import chalk from "chalk";

jest.setTimeout(30000);

beforeAll(() => {
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "-v"],
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/cache-docker-mount-invalid.git (fetch)\norigin\tgit@gitlab.com:gcl/cache-docker-mount-invalid.git (push)\n"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
});

test("cache-docker-mount-globstar <consume-cache> --needs", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/cache-docker-mount-globstar",
            job: ["consume-cache"],
            needs: true,
            mountCache: true,
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blue produce-cache} cannot have * in cache paths, when --mount-cache is enabled`);
    }
});
