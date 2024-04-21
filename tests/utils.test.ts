import {Utils} from "../src/utils";
import {initBashSpyReject, initBashSpy} from "./mocks/utils.mock";

import {isSshDirFound} from "./utils";

test("remoteFileExist protocol: git", async () => {
    const file = "templates/test.yml";
    const ref = "0.3.1";
    const domain = "gitlab.com";
    const projectPath = "components/go";

    // NOTE: Only mocks git archive command if `~/.ssh` ssh dir is not found
    if (!isSshDirFound()) {
        const spyGitArchive = {
            cmd: `git archive --remote=ssh://git@${domain}/${projectPath}.git ${ref} ${file} > /dev/null`,
            returnValue: {output: ""},
        };
        initBashSpy([spyGitArchive]);
    }

    const fileExist = await Utils.remoteFileExist(file, ref, domain, projectPath, "git");
    expect(fileExist).toBe(true);
});

test("remoteFileDoesNotExist protocol: git", async () => {
    const file = "templates/potato.yml";
    const ref = "0.3.1";
    const domain = "gitlab.com";
    const projectPath = "components/go";

    // NOTE: Only mocks git archive command if `~/.ssh` ssh dir is not found
    if (!isSshDirFound()) {
        const spyGitArchive = {
            cmd: `git archive --remote=ssh://git@${domain}/${projectPath}.git ${ref} ${file} > /dev/null`,
            rejection: {
                stderr: `fatal: sent error to the client: git upload-archive: archiver died with error
remote: fatal: pathspec 'templates/potato.yml' did not match any files
remote: git upload-archive: archiver died with error`,
            },
        };
        initBashSpyReject([spyGitArchive]);
    }
    const fileExist = await Utils.remoteFileExist(file, ref, domain, projectPath, "git");
    expect(fileExist).toBe(false);
});
