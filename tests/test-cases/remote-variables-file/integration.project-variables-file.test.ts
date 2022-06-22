import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy, initBashSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    const spyGitArchive = {
        cmd: "git archive --remote=git@gitlab.com:example/firecow.git main variables.yml | tar -xO variables.yml",
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
