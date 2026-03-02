import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-key-files <consume-cache> --shell-isolation --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        job: ["consume-cache"],
        needs: true,
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-cache-key-files-consume-cache",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test.concurrent("cache-key-files <cache-key-file referencing $CI_PROJECT_DIR>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        job: ["cache-key-file referencing $CI_PROJECT_DIR"],
        noColor: true,
        stateDir: ".gitlab-ci-local-cache-key-files-ci-project-dir",
    }, writeStreams);

    const expected = "cache-key-file referencing $CI_PROJECT_DIR cache created in '.gitlab-ci-local-cache-key-files-ci-project-dir/cache/0_/builds/gcl/test-project/fakepackage-8aaa60c7b3009df8ce6973111af131bbcde5636e'";

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});

test.concurrent("cache-key-files <cache-key-file file dont exist>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        job: ["cache-key-file file dont exist"],
        noColor: true,
        stateDir: ".gitlab-ci-local-cache-key-files-file-dont-exist",
    }, writeStreams);

    const expected = "cache-key-file file dont exist cache created in '.gitlab-ci-local-cache-key-files-file-dont-exist/cache/0_no-such-file-18bbe9d7603e540e28418cf4a072938ac477a2c1'";
    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});

test.concurrent("cache-key-files file containing `*` should not crash", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        file: ".gitlab-ci-1.yml",
        noColor: true,
        stateDir: ".gitlab-ci-local-cache-key-files-star",
    }, writeStreams);
});

test.concurrent("cache-key-files file containing `'` should not crash", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/cache-key-files",
        file: ".gitlab-ci-2.yml",
        noColor: true,
        stateDir: ".gitlab-ci-local-cache-key-files-quote",
    }, writeStreams);
});
