import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initBashSpy, initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

test("include-project-file-ref-with-inner-local", async () => {
    const cwd = "tests/test-cases/include-project-file-ref-with-inner-local";
    await fs.rm(`${cwd}/.gitlab-ci-local/`, {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/test-hest.git"},
    };
    const target = ".gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/";
    const spyGitArchive1 = {
        cmd: `set -eou pipefail; git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git include-string-list .gitlab-module-with-local.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    const spyGitArchive2 = {
        cmd: `set -eou pipefail; git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git include-string-list .gitlab-local.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    const spyGitArchive3 = {
        cmd: `set -eou pipefail; git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git include-string-list configs/multiple/*.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    const spyGitArchive4 = {
        cmd: `set -eou pipefail; git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git include-string-list configs/single/*.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    initBashSpy([spyGitArchive1, spyGitArchive2, spyGitArchive3, spyGitArchive4]);
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);

    let mock = `${cwd}/mock-gitlab-module-with-local.yml`;
    let mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/.gitlab-module-with-local.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    mock = `${cwd}/mock-gitlab-local.yml`;
    mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/.gitlab-local.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    mock = `${cwd}/configs/multiple/mock-gitlab-ci-1.yml`;
    mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/configs/multiple/.gitlab-ci-1.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    mock = `${cwd}/configs/multiple/mock-gitlab-ci-2.yml`;
    mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/configs/multiple/.gitlab-ci-2.yml`;
    await fs.copyFile(mock, mockTarget);

    mock = `${cwd}/configs/single/mock-gitlab-ci.yml`;
    mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/configs/single/.gitlab-ci.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    await handler({cwd}, writeStreams);

    const expected = [
        chalk`{blueBright test-job            } {greenBright >} Test something`,
        chalk`{blueBright deploy-job          } {greenBright >} Deploy something`,
        chalk`{blueBright configs-test-job-1  } {greenBright >} Test something`,
        chalk`{blueBright configs-test-job-2  } {greenBright >} Test something`,
        chalk`{blueBright configs-deploy-job-1} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
