import { Utils } from "../src/utils";
import { GitData } from "../src/git-data";
import { when } from "jest-when";

const mock = jest.fn()
const user = {
    GITLAB_USER_EMAIL: "local@test",
    GITLAB_USER_LOGIN: "local",
    GITLAB_USER_NAME: "Local Test"
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
    origin	git@github.com:aepfli/gitlab-ci-local.git (fetch)
    origin	git@github.com:aepfli/gitlab-ci-local.git (push)
    `
        })
});
describe("Git is", () => {
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

        gitLogs.forEach((gitLog, index) => {
            test(`with '${gitLog}'`, async () => {
                const testSha = gitSha + index
                const testShortSha = gitShortSha + index
                when(mock)
                    .calledWith("git log -1 --pretty=format:'%h %H %D'", expect.any(String))
                    .mockReturnValue({
                        stdout: `${testShortSha} ${testSha} ${gitLog}`
                    })

                Utils.spawn = mock
                const gitData = await GitData.init("./");
                expect(gitData.commit.SHA).toEqual(testSha)
                expect(gitData.commit.SHORT_SHA).toEqual(testShortSha)
            })
        })
    })

    describe("non working output", () => {
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
                    .calledWith("git log -1 --pretty=format:'%h %H %D'", expect.any(String))
                    .mockReturnValue({
                        stdout: gitLog
                    })
                Utils.spawn = mock

                const gitData = await GitData.init("./");
                expect(gitData.commit).toEqual(GitData.defaultData.commit)
            })
        })
    });

    test("failing command", async () => {

        when(mock)
            .calledWith("git log -1 --pretty=format:'%h %H %D'", expect.any(String))
            .mockRejectedValue(new Error("error"));
        Utils.spawn = mock

        const gitData = await GitData.init("./");
        expect(gitData.commit).toEqual(GitData.defaultData.commit)
    })

});



describe("Git user data", () => {

    const verifyFailures = async function () {
        Utils.spawn = mock
        const gitData = await GitData.init("./");
        expect(gitData.user).toEqual(GitData.defaultData.user)
    }

    describe("for working output", () => {
        test("default", async () => {
            Utils.spawn = mock
            const gitData = await GitData.init("./");
            expect(gitData.user).toEqual(user)
        })
    })

    describe("error cases", () => {
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

    describe("failing command", () => {
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