import {GitData} from "../src/git-data";
import {initSpawnMock, initSpawnSpy} from "./mocks/utils.mock";
import {MockWriteStreams} from "../src/mock-write-streams";
import chalk from "chalk";
import {WhenStatics} from "./mocks/when-statics";

test("git --version (not present)", async() => {
    initSpawnMock([]);
    const writeStreams = new MockWriteStreams();
    const gitData = await GitData.init("./", writeStreams);
    expect(gitData).toEqual({
        commit: {
            "REF_NAME": "main",
            "SHA": "0000000000000000000000000000000000000000",
            "SHORT_SHA": "00000000",
        },
        remote: {
            "port": "22",
            "host": "gitlab.com",
            "group": "fallback.group",
            "project": "fallback.project",
        },
        user: {
            "GITLAB_USER_EMAIL": "local@gitlab.com",
            "GITLAB_USER_ID": "1000",
            "GITLAB_USER_LOGIN": "local",
            "GITLAB_USER_NAME": "Bob Local",
        },
    });
    expect(writeStreams.stderrLines).toEqual([
        chalk`{yellow Git not available using fallback}`,
    ]);
});

test("git config <user.name|user.email> and id -u (present)", async () => {
    const spawnMocks = [WhenStatics.mockGitVersion, WhenStatics.mockGitConfigEmail, WhenStatics.mockGitConfigName, WhenStatics.mockUID];
    initSpawnMock(spawnMocks);
    const writeStreams = new MockWriteStreams();
    const gitData = await GitData.init("./", writeStreams);
    expect(gitData.user).toEqual({
        "GITLAB_USER_EMAIL": "test@test.com",
        "GITLAB_USER_ID": "990",
        "GITLAB_USER_LOGIN": "test",
        "GITLAB_USER_NAME": "Testersen",
    });
    expect(writeStreams.stderrLines).toEqual([
        chalk`{yellow Using fallback git commit data}`,
        chalk`{yellow Using fallback git remote data}`,
    ]);
});

test("git remote -v (present)", async () => {
    const variousStdouts = [
        "origin git@gitlab.com:gcl/test-project.git (fetch)\n",
        "origin https://git@gitlab.com:gcl/test-project.git (fetch)\n",
        "origin ssh://git@gitlab.com:gcl/test-project.git (fetch)\n",

        "origin git@gitlab.com:3324/gcl/test-project.git (fetch)\n",
        "origin https://git@gitlab.com:3324/gcl/test-project.git (fetch)\n",
        "origin ssh://git@gitlab.com:3324/gcl/test-project.git (fetch)\n",
    ];
    const expectedStderrLines = [
        [chalk`{yellow Using fallback git commit data}`, chalk`{yellow Using fallback git user.name}`, chalk`{yellow Using fallback git user.email}`, chalk`{yellow Using fallback linux user id}`],
        [chalk`{yellow Using fallback git commit data}`, chalk`{yellow Using fallback git user.name}`, chalk`{yellow Using fallback git user.email}`, chalk`{yellow Using fallback linux user id}`],
        [chalk`{yellow Using fallback git commit data}`, chalk`{yellow Using fallback git user.name}`, chalk`{yellow Using fallback git user.email}`, chalk`{yellow Using fallback linux user id}`],
        [chalk`{yellow Using fallback git commit data}`, chalk`{yellow Using fallback git user.name}`, chalk`{yellow Using fallback git user.email}`, chalk`{yellow Using fallback linux user id}`],
        [chalk`{yellow Using fallback git commit data}`, chalk`{yellow Using fallback git user.name}`, chalk`{yellow Using fallback git user.email}`, chalk`{yellow Using fallback linux user id}`],
        [chalk`{yellow Using fallback git commit data}`, chalk`{yellow Using fallback git user.name}`, chalk`{yellow Using fallback git user.email}`, chalk`{yellow Using fallback linux user id}`],
    ];
    const expectedRemotes = [
        {host: "gitlab.com", group: "gcl", project: "test-project", port: "22"},
        {host: "gitlab.com", group: "gcl", project: "test-project", port: "22"},
        {host: "gitlab.com", group: "gcl", project: "test-project", port: "22"},

        {host: "gitlab.com", group: "gcl", project: "test-project", port: "3324"},
        {host: "gitlab.com", group: "gcl", project: "test-project", port: "3324"},
        {host: "gitlab.com", group: "gcl", project: "test-project", port: "3324"},
    ];

    let index = 0;
    for (const stdout of variousStdouts) {
        initSpawnMock([WhenStatics.mockGitVersion, {cmd: "git remote -v", returnValue: {stdout: stdout}}]);
        const writeStreams = new MockWriteStreams();
        const gitData = await GitData.init("./", writeStreams);
        expect(gitData.remote).toEqual(expectedRemotes[index]);
        expect(writeStreams.stderrLines).toEqual(expectedStderrLines[index]);
        index++;
    }
});

test("git remote -v (not present)", async () => {
    const spawnMocks = [
        WhenStatics.mockGitVersion, ...WhenStatics.mockGitCommit, WhenStatics.mockGitConfigEmail, WhenStatics.mockUID, WhenStatics.mockGitConfigName,
    ];
    initSpawnMock(spawnMocks);
    const writeStreams = new MockWriteStreams();
    await GitData.init("./", writeStreams);
    expect(writeStreams.stderrLines).toEqual([
        chalk`{yellow Using fallback git remote data}`,
    ]);
});

test("git remote -v (invalid)", async () => {
    const spawnMocks = [
        {cmd: "git remote -v", returnValue: {stdout: "Very invalid git remote -v\n"}},
    ];
    initSpawnSpy(spawnMocks);
    const writeStreams = new MockWriteStreams();
    await GitData.init("./", writeStreams);
    expect(writeStreams.stderrLines).toEqual([
        chalk`{yellow git remote -v didn't provide valid matches}`,
    ]);
});

test("git log (not present)", async () => {
    const spawnMocks = [WhenStatics.mockGitVersion, WhenStatics.mockGitRemote, WhenStatics.mockGitConfigEmail, WhenStatics.mockUID, WhenStatics.mockGitConfigName];
    initSpawnMock(spawnMocks);
    const writeStreams = new MockWriteStreams();
    await GitData.init("./", writeStreams);
    expect(writeStreams.stderrLines).toEqual([
        chalk`{yellow Using fallback git commit data}`,
    ]);
});

test("git commit data (valid)", async() => {
    const spawnMocks = [WhenStatics.mockGitVersion, ...WhenStatics.mockGitCommit];
    initSpawnMock(spawnMocks);
    const writeStreams = new MockWriteStreams();
    const gitData = await GitData.init("./", writeStreams);
    expect(gitData.commit).toEqual({
        REF_NAME: "master",
        SHA: "02618988a1864b3d06cfee3bd79f8baa2dd21407",
        SHORT_SHA: "0261898",
    });
});

test("git commit data (failure)", async() => {
    const spawnMocks = [
        WhenStatics.mockGitVersion, WhenStatics.mockGitRemote, WhenStatics.mockUID,
        WhenStatics.mockGitConfigName, WhenStatics.mockGitConfigEmail,
        {cmd: "git rev-parse --abbrev-ref HEAD", returnValue: {exitCode: 1}},
    ];
    initSpawnMock(spawnMocks);
    const writeStreams = new MockWriteStreams();
    await GitData.init("./", writeStreams);
    expect(writeStreams.stderrLines).toEqual([chalk`{yellow Using fallback git commit data}`]);
});
