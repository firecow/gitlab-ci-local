import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";
import {assert} from "../../../src/asserts";

jest.setTimeout(30000);

beforeAll(() => {
    const spyGitRemote = {
        cmd: "git remote -v",
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/cache-docker-mount-invalid.git (fetch)\norigin\tgit@gitlab.com:gcl/cache-docker-mount-invalid.git (push)\n"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
});

test("cache-docker-mount-globstar <consume-cache> --needs", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/cache-docker-mount-globstar",
            job: ["consume-cache"],
            needs: true,
            mountCache: true,
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe("produce-cache cannot have * in cache paths, when --mount-cache is enabled");
    }
});
