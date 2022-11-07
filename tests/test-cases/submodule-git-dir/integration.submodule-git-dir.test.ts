import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";

beforeAll(() => {
    const cwd = "tests/test-cases/submodule-git-dir";
    Utils.bash("find . -name .gitlab-ci-local -type d | xargs -I{} rm -rf {} ", cwd);
    Utils.bash("rsync -a --delete git-dir/ .git", cwd);
    Utils.bash("find . -name git-dir -type f | xargs dirname | xargs -I{} cp {}/git-dir {}/.git", cwd);
    Utils.bash("mkdir -p .gitlab-ci-local/output", cwd);
    Utils.bash("touch .gitlab-ci-local/output/build-job.log", cwd);
    initSpawnSpy(WhenStatics.all);
});

test("submodule-git-dir <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/submodule-git-dir",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("submodule-git-dir <build-job> at submodule leaf", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/submodule-git-dir/submodule_moved/mid_folder/submodule/submodule/submodule",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("submodule-git-dir <build-job> at submodule leaf 2", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/submodule-git-dir/submodule_moved/submodule",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("submodule-git-dir <build-job> at submodule level 1", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/submodule-git-dir/submodule_moved",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("submodule-git-dir <build-job> at submodule level 2", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/submodule-git-dir/submodule_moved/mid_folder/submodule",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});