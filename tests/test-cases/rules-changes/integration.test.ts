import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy, initSyncSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk-template";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("rules:changes (has changes))", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "foo"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        stateDir: ".gitlab-ci-local-rules-changes-has-changes",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test.concurrent("rules:changes:paths (has changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "foo"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        file: ".gitlab-ci-2.yml",
        stateDir: ".gitlab-ci-local-rules-changes-paths-has-changes",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test.concurrent("rules:changes (no changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "bar"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        stateDir: ".gitlab-ci-local-rules-changes-no-changes",
    }, writeStreams);

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test.concurrent("rules:changes --no-evaluate-rule-changes (no changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: ""},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        evaluateRuleChanges: false,
        stateDir: ".gitlab-ci-local-rules-changes-no-evaluate",
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});

test.concurrent("rules:changes:paths (no changes)", async () => {
    const writeStreams = new WriteStreamsMock();
    initSyncSpawnSpy([{
        cmdArgs: ["git", "diff", "--name-only", "origin/main"],
        returnValue: {stdout: "bar"},
    }]);
    await handler({
        cwd: "tests/test-cases/rules-changes",
        file: ".gitlab-ci-2.yml",
        stateDir: ".gitlab-ci-local-rules-changes-paths-no-changes",
    }, writeStreams);

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright alpine       } {greenBright >} Job is running`,
        chalk`{blueBright matrix: [foo]} {greenBright >} Job is running`,
    ]));
});
