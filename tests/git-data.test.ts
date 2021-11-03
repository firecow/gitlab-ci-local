import { Utils } from "../src/utils";
import { GitData } from "../src/git-data";

const mock = jest.fn()
    .mockReturnValueOnce({
        stdout: "test"
    })
    .mockReturnValueOnce({
        stdout: "test"
    })

describe("different kind of working responses from git log", () => {
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
            const testSha = gitSha+index
            const testShortSha = gitShortSha+index
            Utils.spawn = mock.mockReturnValue({
                stdout: `${testShortSha} ${testSha} ${gitLog}`
            })
            const gitData = await GitData.init("./");
            expect(gitData.commit.SHA).toEqual(testSha)
            expect(gitData.commit.SHORT_SHA).toEqual(testShortSha)
        })
    })
});


describe("faulty responses from gitlog", () => {
    const gitSha = "02618988a1864b3d06cfee3bd79f8baa2dd21407"
    const gitShortSha = "0261898"
    const gitLogs = [
        `${gitShortSha} ${gitSha} asd -> master, origin/master`,
        `${gitShortSha} ${gitSha} tag: asdf, origin/master`,
        `non valid log`,
        ""
    ]

    gitLogs.forEach((gitLog) => {
        test(`with '${gitLog}'`, async () => {
            
            Utils.spawn = mock.mockReturnValue({
                stdout: gitLog
            })
            expect(GitData.init("./")).rejects.toThrow("git log -1 didn't provide valid matches")
        })
    })
});

