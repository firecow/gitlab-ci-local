import { Utils } from "../src/utils";
import { GitData } from "../src/git-data";
import { when } from "jest-when";

const mock = jest.fn()
const user = {
    GITLAB_USER_EMAIL: "local@test",
    GITLAB_USER_LOGIN: "local",
    GITLAB_USER_NAME: "Local Test"
}
const remote = {
    domain: "local.domain",
    group: "group",
    project: "project"
}

beforeEach(() => {
    when(mock)
        .calledWith(GitData.GIT_COMMAND_AVAILABILITY, expect.any(String))
        .mockReturnValue({
            stdout: "a git version"
        })
    when(mock)
        .calledWith("git config user.email", expect.any(String))
        .mockReturnValue({
            stdout: user.GITLAB_USER_EMAIL
        })
    when(mock)
        .calledWith("git config user.name", expect.any(String))
        .mockReturnValue({
            stdout: user.GITLAB_USER_NAME
        })
    when(mock)
        .calledWith("git remote -v", expect.any(String))
        .mockReturnValue({
            stdout: `
    origin	git@${remote.domain}:${remote.group}/${remote.project}.git (fetch)
    origin	git@${remote.domain}:${remote.group}/${remote.project}.git (push)
    `
        })

    when(mock)
        .calledWith(GitData.GIT_COMMAND_COMMIT, expect.any(String))
        .mockReturnValue({
            stdout: "0261898 02618988a1864b3d06cfee3bd79f8baa2dd21407 HEAD -> master, origin/master"
        })
});

describe("Creating git data", () => {
    test("when everything is fine", async () => {
        Utils.spawn = mock
        const gitData = await GitData.init("./");
        expect(gitData.remote).toEqual(remote)
        expect(gitData.user).toEqual(user)
        expect(gitData.commit.SHA).toEqual("02618988a1864b3d06cfee3bd79f8baa2dd21407")
        expect(gitData.commit.SHORT_SHA).toEqual("0261898")
        expect(gitData.commit.REF_NAME).toEqual("master")
    })
})

describe("Git commit data", () => {
    describe("for working output", () => {
        const gitSha = "02618988a1864b3d06cfee3bd79f8baa2dd21407"
        const gitShortSha = "0261898"
        const gitLogs = [
            `grafted, HEAD -> master, origin/master`,
            `grafted, HEAD, pull/3/merge`,
            `HEAD, pull/3/merge`,
            `HEAD, tag: pull/3/merge`,
            `HEAD -> master, origin/master`
        ]

    describe("when git is", () => {
        describe("not available", () => {
            test("as null", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_AVAILABILITY, expect.any(String))
                    .mockReturnValue({
                        stdout: null
                    })

                Utils.spawn = mock
                const gitData = await GitData.init("./");
                expect(gitData).toEqual(GitData.defaultData)

            })
            test("as undefined", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_AVAILABILITY, expect.any(String))
                    .mockReturnValue({
                        stdout: undefined
                    })
                Utils.spawn = mock
                const gitData = await GitData.init("./");
                expect(gitData).toEqual(GitData.defaultData)
            })
            test("by throwing an error", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_AVAILABILITY, expect.any(String))
                    .mockRejectedValue(new Error("error"));
                Utils.spawn = mock
                const gitData = await GitData.init("./");
                expect(gitData).toEqual(GitData.defaultData)
            })
        })
    })

    describe("only for git commit data", () => {
        describe("for working input", () => {
            const gitSha = "02618988a1864b3d06cfee3bd79f8baa2dd21407"
            const gitShortSha = "0261898"
            const gitLogs = [
                `grafted, HEAD -> master, origin/master`,
                `grafted, HEAD, pull/3/merge`,
                `HEAD, pull/3/merge`,
                `HEAD, tag: pull/3/merge`,
                `HEAD -> master, origin/master`
            ]

            gitLogs.forEach((gitLog, index) => {
                test(`with '${gitLog}'`, async () => {
                    const testSha = gitSha + index
                    const testShortSha = gitShortSha + index
                    when(mock)
                        .calledWith(GitData.GIT_COMMAND_COMMIT, expect.any(String))
                        .mockReturnValue({
                            stdout: `${testShortSha} ${testSha} ${gitLog}`
                        })

                    Utils.spawn = mock
                    const gitData = await GitData.getCommitData("./");
                    expect(gitData.SHA).toEqual(testSha)
                    expect(gitData.SHORT_SHA).toEqual(testShortSha)
                })
            })
        })

        describe("for faulty input", () => {
            const gitSha = "02618988a1864b3d06cfee3bd79f8baa2dd21407"
            const gitShortSha = "0261898"
            const gitLogs = [
                `${gitShortSha} ${gitSha} asd -> master, origin/master`,
                `${gitShortSha} ${gitSha} tag: asdf, origin/master`,
                `non valid log`,
                "",
                null
            ]

            gitLogs.forEach((gitLog) => {
                test(`with '${gitLog}'`, async () => {
                    when(mock)
                        .calledWith(GitData.GIT_COMMAND_COMMIT, expect.any(String))
                        .mockReturnValue({
                            stdout: gitLog
                        })
                    Utils.spawn = mock

                    const gitData = await GitData.getCommitData("./");
                    expect(gitData).toEqual(GitData.defaultData.commit)
                })
            })
        });

        test("with failing command", async () => {

            when(mock)
                .calledWith(GitData.GIT_COMMAND_COMMIT, expect.any(String))
                .mockRejectedValue(new Error("error"));
            Utils.spawn = mock

            const gitData = await GitData.getCommitData("./");
            expect(gitData).toEqual(GitData.defaultData.commit)
        })

    });

    describe("only for git user data", () => {

        const verifyFailures = async function () {
            Utils.spawn = mock
            const gitData = await GitData.getUserData("./");
            expect(gitData).toEqual(GitData.defaultData.user)
        }

        describe("for working input", () => {
            test("default", async () => {
                Utils.spawn = mock
                const gitData = await GitData.getUserData("./");
                expect(gitData).toEqual(user)
            })
        })

        describe("with error cases", () => {
            test("for user.email", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_USER_EMAIL, expect.any(String))
                    .mockReturnValue({
                        stdout: null
                    })
                verifyFailures()
            })
            test("for user.name", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_USER_USERNAME, expect.any(String))
                    .mockReturnValue({
                        stdout: null
                    })
                verifyFailures()
            })
        })

        describe("with failing command", () => {
            test("for user.email", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_USER_EMAIL, expect.any(String))
                    .mockRejectedValue(new Error("error"));
                verifyFailures()
            })
            test("for user.name", async () => {
                when(mock)
                    .calledWith(GitData.GIT_COMMAND_USER_USERNAME, expect.any(String))
                    .mockRejectedValue(new Error("error"));
                verifyFailures()
            })
        })
    })

    describe("only for git commit data", () => {
        describe("for working input", () => {
            const gitSha = "02618988a1864b3d06cfee3bd79f8baa2dd21407"
            const gitShortSha = "0261898"
            const gitLogs = [
                `grafted, HEAD -> master, origin/master`,
                `grafted, HEAD, pull/3/merge`,
                `HEAD, pull/3/merge`,
                `HEAD, tag: pull/3/merge`,
                `HEAD -> master, origin/master`
            ]

            gitLogs.forEach((gitLog, index) => {
                test(`with '${gitLog}'`, async () => {
                    const testSha = gitSha + index
                    const testShortSha = gitShortSha + index
                    when(mock)
                        .calledWith(GitData.GIT_COMMAND_COMMIT, expect.any(String))
                        .mockReturnValue({
                            stdout: `${testShortSha} ${testSha} ${gitLog}`
                        })

                    Utils.spawn = mock
                    const gitData = await GitData.getCommitData("./");
                    expect(gitData.SHA).toEqual(testSha)
                    expect(gitData.SHORT_SHA).toEqual(testShortSha)
                })
            })
        })

    describe("only for git remote data", () => {
        describe("for working input via", () => {
            describe("ssh", () => {
                test("where root group is used as port", async () => {
                    when(mock)
                        .calledWith("git remote -v", expect.any(String))
                        .mockReturnValue({
                            stdout: `
                        origin	git@${remote.domain}:${remote.group}/${remote.project}.git (fetch)
                        origin	git@${remote.domain}:${remote.group}/${remote.project}.git (push)
                        `
                        })
                    Utils.spawn = mock
                    const gitData = await GitData.getRemoteData("./");
                    expect(gitData).toEqual(remote)
                })
                test("root group is used in path", async () => {
                    when(mock)
                        .calledWith("git remote -v", expect.any(String))
                        .mockReturnValue({
                            stdout: `
                        origin	git@${remote.domain}/${remote.group}/${remote.project}.git (fetch)
                        origin	git@${remote.domain}/${remote.group}/${remote.project}.git (push)
                        `
                        })
                    Utils.spawn = mock
                    const gitData = await GitData.getRemoteData("./");
                    expect(gitData).toEqual(remote)
                })
            });
            test("https", async () => {
                when(mock)
                    .calledWith("git remote -v", expect.any(String))
                    .mockReturnValue({
                        stdout: `
                        origin	https://git:git@${remote.domain}/${remote.group}/${remote.project}.git (fetch)
                        origin	https://git:git@${remote.domain}/${remote.group}/${remote.project}.git (push)
                        `
                    })
                Utils.spawn = mock
                const gitData = await GitData.getRemoteData("./");
                expect(gitData).toEqual(remote)
            })
        })

        test("for non working inputs", async () => {
            when(mock)
                .calledWith(GitData.GIT_COMMAND_REMOTE, expect.any(String))
                .mockReturnValue({
                    stdout: "not working"
                });
            Utils.spawn = mock

            const gitData = await GitData.getRemoteData("./");
            expect(gitData).toEqual(GitData.defaultData.remote)
        });

        test("for failing command", async () => {

            when(mock)
                .calledWith(GitData.GIT_COMMAND_REMOTE, expect.any(String))
                .mockRejectedValue(new Error("error"));
            Utils.spawn = mock

            const gitData = await GitData.getRemoteData("./");
            expect(gitData).toEqual(GitData.defaultData.remote)
        })

    });

})
