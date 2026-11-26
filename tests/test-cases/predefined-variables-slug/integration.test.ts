import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "git@gitlab.com:gcl/my_project.js.git"},
    };
    const spyGitBranchName = {
        cmdArgs: ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        returnValue: {stdout: "feature/foo--bar_"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote, spyGitBranchName]);
});

// GitLab's Gitlab::Utils.slugify turns every character outside [a-z0-9] into its own "-",
// without squeezing runs, and then trims leading and trailing "-".
test("predefined-variables-slug <build - linux>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/predefined-variables-slug",
        job: ["build - linux"],
        stateDir: ".gitlab-ci-local-predefined-variables-slug",
    }, writeStreams);

    const expected = [
        chalk`{blueBright build - linux} {greenBright >} CI_COMMIT_REF_SLUG=feature-foo--bar`,
        chalk`{blueBright build - linux} {greenBright >} CI_JOB_NAME_SLUG=build---linux`,
        chalk`{blueBright build - linux} {greenBright >} CI_PROJECT_PATH_SLUG=gcl-my-project-js`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
