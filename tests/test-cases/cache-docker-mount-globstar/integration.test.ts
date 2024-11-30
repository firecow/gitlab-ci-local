import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert, {AssertionError} from "assert";
import chalk from "chalk";

import.meta.jest.setTimeout(30000);

beforeAll(() => {
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/cache-docker-mount-invalid.git"},
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
