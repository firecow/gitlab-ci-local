import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initBashSpy, initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {Utils} from "../../../src/utils.js";
import fs from "fs-extra";

test("include-project-file-with-space-in-filename", async () => {
    const cwd = "tests/test-cases/include-project-file-with-space-in-filename";
    await fs.rm(`${cwd}/.gitlab-ci-local/`, {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/test-hest.git"},
    };
    const spyGitArchiveAny = {
        cmd: expect.stringContaining("git archive --remote="),
        returnValue: {output: ""},
    };
    const bashSpy = initBashSpy([spyGitArchiveAny]);
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);

    const target = ".gitlab-ci-local/includes/gitlab.com/firecow/gitlab-ci-local-includes/include-string-list/";
    const mock = `${cwd}/mock-file with spaces.yml`;
    const mockTarget = `${cwd}/${target}file with spaces.yml`;
    await fs.ensureFile(mockTarget);
    await fs.copyFile(mock, mockTarget);

    await handler({cwd, fetchIncludes: true}, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const invokedCommand = bashSpy.mock.calls.map((call) => call[0]).find((cmd) => cmd.includes("file with spaces.yml"));
    expect(invokedCommand).toBeDefined();
    expect(invokedCommand).toContain(`-- ${Utils.safeBashString("include-string-list")} ${Utils.safeBashString("file with spaces.yml")}`);
});
