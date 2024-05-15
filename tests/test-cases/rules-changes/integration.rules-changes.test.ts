import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy, initSyncSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
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

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{blueBright alpine} {greenBright >} Job is running\n`
    );
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

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{blueBright alpine} {greenBright >} Job is running\n`
    );
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

    expect(writeStreams.stdoutLines.join("\n")).not.toContain(
        chalk`{blueBright alpine} {greenBright >} Job is running\n`
    );
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

    expect(writeStreams.stdoutLines.join("\n")).not.toContain(
        chalk`{blueBright alpine} {greenBright >} Job is running\n`
    );
});
