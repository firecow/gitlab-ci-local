import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert, {AssertionError} from "assert";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("include-local <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
        stateDir: ".gitlab-ci-local-include-local-build-job",
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Build something`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("include-local <test-job> (short-list)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local",
        file: ".gitlab-ci-short-list.yml",
        job: ["test-job"],
        stateDir: ".gitlab-ci-local-include-local-test-job-short-list",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("include-local <deploy-job> (short-single)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/include-local",
        file: ".gitlab-ci-short-single.yml",
        job: ["deploy-job"],
        stateDir: ".gitlab-ci-local-include-local-deploy-job-short-single",
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("include-local invalid config (directory traversal)", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-local",
            file: ".gitlab-ci-invalid-config-directory-traversal.yml",
            stateDir: ".gitlab-ci-local-include-local-invalid-config-directory-traversal",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual("`../include-local/.gitlab-ci.yml` for include:local is invalid. Gitlab does not support directory traversal.");
        return;
    }
    throw new Error("Error is expected but not thrown/caught");
});

test.concurrent("include-local invalid config (relative path)", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-local",
            file: ".gitlab-ci-invalid-config-relative-path.yml",
            stateDir: ".gitlab-ci-local-include-local-invalid-config-relative-path",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toEqual("`./.gitlab-ci.yml` for include:local is invalid. Gitlab does not support relative path (ie. cannot start with `./`).");
        return;
    }
    throw new Error("Error is expected but not thrown/caught");
});
