import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import fs from "fs-extra";

test("include-project-file-ref-with-inner-local", async () => {
    const cwd = "tests/test-cases/include-project-file-ref-with-inner-local";
    await fs.rm(`${cwd}/.gitlab-ci-local/`, {recursive: true, force: true});
    const writeStreams = new MockWriteStreams();
    const spyGitRemote = {
        cmd: "git remote -v",
        returnValue: {stdout: "origin\tgit@gitlab.com:gcl/test-hest.git (fetch)\norigin\tgit@gitlab.com:gcl/test-hest.git (push)\n"},
    };
    const target = ".gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/";
    const spyGitArchive1 = {
        cmd: `git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git include-string-list .gitlab-module-with-local.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    const spyGitArchive2 = {
        cmd: `git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git include-string-list .gitlab-local.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote, spyGitArchive1, spyGitArchive2]);

    let mock = `${cwd}/mock-gitlab-module-with-local.yml`;
    let mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/.gitlab-module-with-local.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    mock = `${cwd}/mock-gitlab-local.yml`;
    mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/.gitlab-local.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    await handler({cwd}, writeStreams);

    const expected = [
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines).toEqual([]);
});
