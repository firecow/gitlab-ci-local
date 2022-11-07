import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";

beforeAll(() => {
    const cwd = "tests/test-cases/git-strategy";
    Utils.bash("find . -name .gitlab-ci-local -type d | xargs -I{} rm -rf {} ", cwd);
    Utils.bash("rsync -a --delete git-dir/ .git", cwd);
    Utils.bash("find . -name git-dir -type f | xargs dirname | xargs -I{} cp {}/git-dir {}/.git", cwd);
    Utils.bash("mkdir -p .gitlab-ci-local/output", cwd);
    Utils.bash("touch .gitlab-ci-local/output/build-job.log", cwd);
    initSpawnSpy(WhenStatics.all);
});

/*
GIT_SUBMODULE_STRATEGY: none, normal, and recursive (default none)
GIT_SUBMODULE_PATHS: git/gitlab-ci (if no all) https://gitlab.com/bollenn/gitlab/-/commit/e2a37ca9228a48ed302885967519561abe69f169
GIT_STRATEGY: clone, fetch, and none (default fetch)
GIT_CHECKOUT: false and true (true) used when the GIT_STRATEGY is set to either clone or fetch
GIT_CLEAN_FLAGS: (defaults -ffdx) is disabled if GIT_CHECKOUT: "false" is specified
GIT_FETCH_EXTRA_FLAGS: (default to --prune --quiet) variable to control the behavior of git fetch
GIT_SUBMODULE_UPDATE_FLAGS: default flags. --init, if GIT_SUBMODULE_STRATEGY was set to normal or recursive. --recursive, if GIT_SUBMODULE_STRATEGY was set to recursive.
GIT_DEPTH: defaults to 50
GIT_CLONE_PATH: $CI_BUILDS_DIR/project-name (Handling concurrency) This can only be used when custom_build_dir is enabled in the runner’s configuration.
 */

test("git-strategy <build-job> none", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy",
        file: ".gitlab-ci-strategy-none.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("git-strategy <build-job> invalid", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy",
        file: ".gitlab-ci-strategy-invalid.yml",
        job: ["build-job"],
    }, writeStreams);

    const notExpected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining(notExpected));

    const expected = [
        chalk`GIT_STRATEGY=invalid is not supported`,
    ];

    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expected));

});

test("git-strategy <build-job> default", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy",
        file: ".gitlab-ci-default.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("git-strategy <build-job> default in submodule", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy/submodule_moved",
        file: ".gitlab-ci-default.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("git-strategy <build-job> default submodule_strategy normal", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy",
        file: ".gitlab-ci-default-submodule-normal.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("git-strategy <build-job> default submodule_strategy recursive", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy",
        file: ".gitlab-ci-default-submodule-recursive.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("git-strategy <build-job> default in submodule normal with submodule path", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy/submodule_moved",
        file: ".gitlab-ci-default-submodule-normal-submodule-path.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("git-strategy <build-job> default in submodule recursive with submodule path", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/git-strategy/submodule_moved",
        file: ".gitlab-ci-default-submodule-recursive-submodule-path.yml",
        job: ["build-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} repo is correct`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});