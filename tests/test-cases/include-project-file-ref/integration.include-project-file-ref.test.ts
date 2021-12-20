import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import fs from "fs-extra";

test("include-project-file-ref <deploy-job>", async () => {
    await fs.rm("tests/test-cases/include-project-file-ref/.gitlab-ci-local", {recursive: true, force: true});
    const writeStreams = new MockWriteStreams();
    const spyGitRemote = {
        cmd: "git remote -v",
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/test-hest.git (fetch)\norigin\tgit@gitlab.com:gcl/test-hest.git (push)\n"},
    };
    const target = ".gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/master/";
    const spyGitArchive = {
        cmd: `git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git master .gitlab-module.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote, spyGitArchive]);
    const mock = "tests/test-cases/include-project-file-ref/mock-gitlab-module.yml";
    const mockTarget = "tests/test-cases/include-project-file-ref/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/master/.gitlab-module.yml";
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);
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
