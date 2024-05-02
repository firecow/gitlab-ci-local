import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initBashSpy, initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import fs from "fs-extra";

test("include-project-file-ref <deploy-job>", async () => {
    await fs.rm("tests/test-cases/include-project-file-ref/.gitlab-ci-local", {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    const spyGitRemote = {
        cmdArgs: ["bash", "-c", "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/test-hest.git"},
    };
    const target = ".gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/HEAD/";
    const spyGitArchive = {
        cmd: `git archive --remote=ssh://git@gitlab.com:22/firecow/gitlab-ci-local-includes.git HEAD .gitlab-module.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    initBashSpy([spyGitArchive]);
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);
    const mock = "tests/test-cases/include-project-file-ref/mock-gitlab-module.yml";
    const mockTarget = "tests/test-cases/include-project-file-ref/.gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/HEAD/.gitlab-module.yml";
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
});
