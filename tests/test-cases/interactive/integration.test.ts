import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import chalk from "chalk-template";
import assert, {AssertionError} from "assert";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("interactive <fake-shell-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/interactive",
        job: ["fake-shell-job"],
        shellExecutorNoImage: true,
        stateDir: ".gitlab-ci-local-interactive-fake-shell-job",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test.concurrent("interactive <fake-shell-job> --no-shell-executor-no-image", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/interactive",
            job: ["fake-shell-job"],
            shellExecutorNoImage: false,
            stateDir: ".gitlab-ci-local-interactive-fake-shell-job-no-shell-executor-no-im",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual(chalk`{blueBright fake-shell-job} @Interactive decorator cannot be used with --no-shell-executor-no-image`);
    }
});
