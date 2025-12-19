import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initBashSpy, initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-project-file-with-variable test-job", async () => {
    const cwd = "tests/test-cases/include-project-file-with-variable";

    await fs.rm(`${cwd}/.gitlab-ci-local/`, {recursive: true, force: true});

    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:test-group/gitlab-ci-local-test.git"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);

    const target = ".gitlab-ci-local/includes/gitlab.com/test-group/gitlab-ci-local-test/HEAD/";
    const spyGitArchive1 = {
        cmd: `git archive --remote=ssh://git@gitlab.com:22/test-group/gitlab-ci-local-test.git HEAD test-file.yml | tar -f - -xC ${target}`,
        returnValue: {output: ""},
    };
    initBashSpy([spyGitArchive1]);

    const mock = `${cwd}/mock-test-file.yml`;
    const mockTarget = `${cwd}/.gitlab-ci-local/includes/gitlab.com/test-group/gitlab-ci-local-test/HEAD/test-file.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd,
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Hello from test file`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
