import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

test("include-remote-with-inner-local", async () => {
    const writeStreams = new MockWriteStreams();
    const spyGitRemote = {
        cmd: "git remote -v",
        returnValue: {stdout: "origin\tgit@gitlab.com:aepfli/include-remote-with-inner-local.git (fetch)\norigin\tgit@gitlab.com:aepfli/include-remote-with-inner-local.git (push)\n"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
    await handler({
        cwd: "tests/test-cases/include-remote-with-inner-local",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
