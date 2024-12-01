import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initBashSpy, initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    const spyGitArchive = {
        cmd: "set -eou pipefail; git archive --remote=git@gitlab.com:example/firecow.git main variables.yml | tar -xO variables.yml",
        returnValue: {stdout: "---\nglobal:\n  SOMEVARIABLE: very-special-value"},
    };
    initSpawnSpy([...WhenStatics.all]);
    initBashSpy([spyGitArchive]);
});

test.concurrent("remote-variables-file <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/remote-variables-file",
        job: ["test-job"],
        remoteVariables: "git@gitlab.com:example/firecow.git=variables.yml=main",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} very-special-value`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
