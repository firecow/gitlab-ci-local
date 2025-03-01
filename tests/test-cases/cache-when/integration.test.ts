import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import fs from "fs-extra";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache:when = on_success", async () => {
    await fs.rm("tests/test-cases/cache-directives/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-when",
        job: ["on_success_without_error", "on_success_with_error"],
        shellIsolation: true,
    }, writeStreams);

    await expect(fs.pathExists("tests/test-cases/cache-when/.gitlab-ci-local/cache/on_success_without_error/cache/file1.txt")).resolves.toBe(true);
    await expect(fs.pathExists("tests/test-cases/cache-when/.gitlab-ci-local/cache/on_success_with_error/cache/file1.txt")).resolves.toBe(false);
});
test.concurrent("cache:when = on_failure", async () => {
    await fs.rm("tests/test-cases/cache-directives/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-when",
        job: ["on_failure_without_error", "on_failure_with_error"],
        shellIsolation: true,
    }, writeStreams);

    await expect(fs.pathExists("tests/test-cases/cache-when/.gitlab-ci-local/cache/on_failure_without_error/cache/file1.txt")).resolves.toBe(false);
    await expect(fs.pathExists("tests/test-cases/cache-when/.gitlab-ci-local/cache/on_failure_with_error/cache/file1.txt")).resolves.toBe(true);
});
test.concurrent("cache:when = always", async () => {
    await fs.rm("tests/test-cases/cache-directives/.gitlab-ci-local/cache/", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-when",
        job: ["always_without_error", "always_with_error"],
        shellIsolation: true,
    }, writeStreams);

    await expect(fs.pathExists("tests/test-cases/cache-when/.gitlab-ci-local/cache/always_without_error/cache/file1.txt")).resolves.toBe(true);
    await expect(fs.pathExists("tests/test-cases/cache-when/.gitlab-ci-local/cache/always_with_error/cache/file1.txt")).resolves.toBe(true);
});
