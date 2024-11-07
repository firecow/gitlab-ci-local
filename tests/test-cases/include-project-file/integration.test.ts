import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
    const spyGitRemote = {
        cmdArgs: ["git", "remote", "get-url", "origin"],
        returnValue: {stdout: "https://gitlab.com/firecow/gitlab-ci-local.git"},
    };
    initSpawnSpy([...WhenStatics.all, spyGitRemote]);

});

afterAll(() => {
    fs.rmSync("tests/test-cases/include-project-file/.gitlab-ci-local", {recursive: true, force: true});
});

test("include:project be able to target branch via ref", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        file: ".gitlab-ci-1.yml",
        cwd: "tests/test-cases/include-project-file",
        noColor: true,
    }, writeStreams);


    const expected = "job > hello world from dev branch";

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("job >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test("include:project should target default branch when ref is missing", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        file: ".gitlab-ci-2.yml",
        cwd: "tests/test-cases/include-project-file",
        noColor: true,
    }, writeStreams);


    const expected = "job > hello world from default branch";

    const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("job >")).join("\n");
    expect(filteredStdout).toEqual(expected);
});

test("include:project should respect rules specified in included project", async () => {
    const writeStreams = new WriteStreamsMock();

    await handler({
        file: ".gitlab-ci-3.yml",
        cwd: "tests/test-cases/include-project-file",
        noColor: true,
        list: true,
    }, writeStreams);


    const expected = [
        "name                                    description  stage   when        allow_failure  needs",
        "should execute since rule eval to true               test    on_success  false      ",
    ];

    expect(writeStreams.stdoutLines.join("\n")).toEqual(expected.join("\n"));
});
