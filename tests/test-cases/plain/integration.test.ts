import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import fs from "fs-extra";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("plain", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        jsonSchemaValidation: true,
        stateDir: ".gitlab-ci-local-plain",
    }, writeStreams);

    expect(writeStreams.stdoutLines.length).toEqual(16);
    expect(writeStreams.stderrLines.length).toEqual(4);

    expect(await fs.pathExists("tests/test-cases/plain/.gitlab-ci-local-plain/builds/test-job")).toBe(false);
    expect(await fs.pathExists("tests/test-cases/plain/.gitlab-ci-local-plain/builds/build-job")).toBe(false);
});

test.concurrent("plain <test-job> <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        job: ["test-job", "test-job"],
        stateDir: ".gitlab-ci-local-plain-test-job-test-job",
    }, writeStreams);

    const found = writeStreams.stderrLines.filter((l) => {
        return l.match(/Hello, error!/) !== null;
    });
    expect(found.length).toEqual(1);
});

test.concurrent("plain <notfound>", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/plain",
            job: ["notfound"],
            stateDir: ".gitlab-ci-local-plain-notfound",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright notfound} could not be found`);
    }
});

test.concurrent("plain <build-job> --unset-variable ", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        job: ["build-job"],
        unsetVariable: ["TEST_VAR"],
        stateDir: ".gitlab-ci-local-plain-build-job-unset-variable",
    }, writeStreams);
    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/whatwhatwhat/) !== null;
    });
    expect(found.length).toEqual(0);
});

test.concurrent("plain --stage", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        stage: "test",
        stateDir: ".gitlab-ci-local-plain-stage",
    }, writeStreams);

    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/build-job/) !== null;
    });
    expect(found.length).toEqual(0);
});
