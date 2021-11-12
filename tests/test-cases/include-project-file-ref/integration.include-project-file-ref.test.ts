import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

test("include-project-file-ref <deploy-job>", async () => {
    const writeStreams = new MockWriteStreams();
    const spyGitRemote = {
        cmd: "git remote -v",
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/custom-home.git (fetch)\norigin\tgit@gitlab.com:gcl/custom-home.git (push)\n"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
    await handler({
        cwd: "tests/test-cases/include-project-file-ref",
        job: ["deploy-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
