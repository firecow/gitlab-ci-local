import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("never-needs <test-job> --needs", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/never-needs/",
            job: ["test-job"],
            needs: true,
            stateDir: ".gitlab-ci-local-never-needs-test-job-needs",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright never-job} is when:never, but its needed by {blueBright test-job}`);
    }
});

test.concurrent("never-needs <test-job-optional> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/never-needs/",
        job: ["test-job-optional"],
        needs: true,
        stateDir: ".gitlab-ci-local-never-needs-test-job-optional-needs",
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});
