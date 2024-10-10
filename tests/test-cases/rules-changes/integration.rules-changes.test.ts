import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy, initSyncSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("rules:changes (has changes))", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "foo"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test("rules:changes:paths (has changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "foo"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        file: ".gitlab-ci-rules:changes:paths.yml",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test("rules:changes (no changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "bar"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
    }, writeStreams);

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test("rules:changes:paths (no changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "bar"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        file: ".gitlab-ci-rules:changes:paths.yml",
    }, writeStreams);

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});
