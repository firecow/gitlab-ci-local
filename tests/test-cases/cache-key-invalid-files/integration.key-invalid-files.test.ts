import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {AssertionError} from "assert";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-key-invalid-files <issue-910-three> --shell-isolation", async () => {
    await fs.rm("tests/test-cases/cache-key-invalid-files/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();

    await expect(
        handler({
            cwd: "tests/test-cases/cache-key-invalid-files",
            file: ".gitlab-ci-three.yml",
            needs: false,
            shellIsolation: true,
        }, writeStreams)
    ).rejects.toThrow(AssertionError);
});

test.concurrent("cache-key-invalid-files <issue-910-empty> --shell-isolation", async () => {
    await fs.rm("tests/test-cases/cache-key-invalid-files/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();

    await expect(
        handler({
            cwd: "tests/test-cases/cache-key-invalid-files",
            file: ".gitlab-ci-empty.yml",
            needs: false,
            shellIsolation: true,
        }, writeStreams)
    ).rejects.toThrow(AssertionError);
});
