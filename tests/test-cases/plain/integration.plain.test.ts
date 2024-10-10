import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import fs from "fs-extra";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("plain", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        jsonSchemaValidation: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines.length).toEqual(16);
    expect(writeStreams.stderrLines.length).toEqual(4);

    expect(await fs.pathExists("tests/test-cases/plain/.gitlab-ci-local/builds/test-job")).toBe(false);
    expect(await fs.pathExists("tests/test-cases/plain/.gitlab-ci-local/builds/build-job")).toBe(false);
});

test("plain <test-job> <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        job: ["test-job", "test-job"],
    }, writeStreams);

    const found = writeStreams.stderrLines.filter((l) => {
        return l.match(/Hello, error!/) !== null;
    });
    expect(found.length).toEqual(1);
});

test("plain <notfound>", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/plain",
            job: ["notfound"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright notfound} could not be found`);
    }
});

test("plain <build-job> --unset-variable ", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        job: ["build-job"],
        unsetVariable: ["TEST_VAR"],
    }, writeStreams);
    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/whatwhatwhat/) !== null;
    });
    expect(found.length).toEqual(0);
});

test("plain --stage", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/plain",
        stage: "test",
    }, writeStreams);

    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/build-job/) !== null;
    });
    expect(found.length).toEqual(0);
});
