import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import { Utils } from "../../../src/utils";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
    // copy tests/test-cases/submodule-dotgit/dotgit to tests/test-cases/submodule-dotgit/.git if it doesn't exist
    const cwd = "tests/test-cases/submodule-dotgit"
    Utils.bash('rsync -a --delete dotgit/ .git', cwd);
    Utils.bash('find . -name dotgit -type f | xargs dirname | xargs -I{} cp {}/dotgit {}/.git', cwd);

});

test("submodule-dotgit <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/submodule-dotgit",
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("submodule-dotgit <build-job> at submodule leaf", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: `tests/test-cases/submodule-dotgit/submodule_moved/mid_folder/submodule/submodule/submodule`,
        file: ".gitlab-ci.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} gitdir and worktree are ok`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
