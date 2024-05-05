import {Utils} from "./utils";
import assert, {AssertionError} from "assert";
import {WriteStreams} from "./write-streams";
import chalk from "chalk";

export class GitData {

    public readonly user = {
        GITLAB_USER_LOGIN: "local",
        GITLAB_USER_EMAIL: "local@gitlab.com",
        GITLAB_USER_NAME: "Bob Local",
        GITLAB_USER_ID: "1000",
    };

    public readonly branches = {
        default: "main",
    };

    public readonly remote = {
        schema: "git",
        port: "22",
        host: "gitlab.com",
        group: "fallback.group",
        project: "fallback.project",
    };

    public readonly commit = {
        REF_NAME: "main",
        SHA: "0000000000000000000000000000000000000000",
        SHORT_SHA: "00000000",
    };

    static async init (cwd: string, writeStreams: WriteStreams): Promise<GitData> {
        const gitData = new GitData();
        const promises = [];
        promises.push(gitData.initCommitData(cwd, writeStreams));
        promises.push(gitData.initRemoteData(cwd, writeStreams));
        promises.push(gitData.initUserData(cwd, writeStreams));
        promises.push(gitData.initBranchData(cwd, writeStreams));
        await Promise.all(promises);
        return gitData;
    }

    private async initCommitData (cwd: string, writeStreams: WriteStreams): Promise<void> {
        const promises = [];

        const refNamePromise = Utils.spawn(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd);
        promises.push(refNamePromise.then(({stdout}) => {
            this.commit.REF_NAME = stdout.trimEnd();
        }));

        const shaPromise = Utils.spawn(["git", "rev-parse", "HEAD"], cwd);
        promises.push(shaPromise.then(({stdout}) => {
            this.commit.SHA = stdout.trimEnd();
        }));

        try {
            await Promise.all(promises);
        } catch (e) {
            if (e instanceof AssertionError) {
                return writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
            }
            writeStreams.stderr(chalk`{yellow Using fallback git commit data}\n`);
        }
    }

    private async initBranchData (cwd: string, writeStreams: WriteStreams): Promise<void> {
        try {
            const {stdout: gitRemoteDefaultBranch} = await Utils.spawn(["git", "symbolic-ref", "--short", "refs/remotes/origin/HEAD"], cwd);
            const gitRemoteDefaultBranchMatch = /^origin\/(?<default>[^/]+)$/.exec(gitRemoteDefaultBranch);

            assert(gitRemoteDefaultBranchMatch?.groups != null, "git symbolic-ref --short refs/remotes/origin/HEAD didn't provide valid matches");
            this.branches.default = gitRemoteDefaultBranchMatch.groups.default;
        } catch (e) {
            if (e instanceof AssertionError) {
                writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
                return;
            }
            writeStreams.stderr(chalk`{yellow Using fallback branch data}\n`);
        }
    }

    private async initRemoteData (cwd: string, writeStreams: WriteStreams): Promise<void> {
        try {
            let gitRemoteMatch;
            const {stdout: gitRemote} = await Utils.spawn(["bash", "-c", "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin"], cwd);

            if (gitRemote.startsWith("http")) {
                gitRemoteMatch = /(?<schema>https?):\/\/(?:(\w+):([\w-]+)@)?(?<host>[^/:]+):?(?<port>\d+)?\/(?<group>\S+)\/(?<project>\S+)\.git/.exec(gitRemote); // regexr.com/7ve8l
                assert(gitRemoteMatch?.groups != null, "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin");

                let port = "443";
                if (gitRemoteMatch.groups.schema === "https") {
                    port = gitRemoteMatch.groups.port ?? "443";
                } else if (gitRemoteMatch.groups.schema === "http") {
                    port = gitRemoteMatch.groups.port ?? "80";
                }
                this.remote.host = gitRemoteMatch.groups.host;
                this.remote.group = gitRemoteMatch.groups.group;
                this.remote.project = gitRemoteMatch.groups.project;
                this.remote.schema = gitRemoteMatch.groups.schema;
                this.remote.port = port;
            } else if (gitRemote.startsWith("ssh://")) {
                gitRemoteMatch = /(?<schema>ssh):\/\/(\w+)@(?<host>[^/:]+):?(?<port>\d+)?\/(?<group>\S+)\/(?<project>\S+)\.git/.exec(gitRemote); // regexr.com/7vjq4
                assert(gitRemoteMatch?.groups != null, "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin");

                this.remote.host = gitRemoteMatch.groups.host;
                this.remote.group = gitRemoteMatch.groups.group;
                this.remote.project = gitRemoteMatch.groups.project;
                this.remote.schema = gitRemoteMatch.groups.schema;
                this.remote.port = gitRemoteMatch.groups.port ?? "22";
            } else {
                gitRemoteMatch = /(?<username>\S+)@(?<host>[^:]+):(?<group>\S+)\/(?<project>[^ .]+)\.git/.exec(gitRemote); // regexr.com/7vjoq
                assert(gitRemoteMatch?.groups != null, "git remote get-url gcl-origin 2> /dev/null || git remote get-url origin");

                const {stdout} = await Utils.spawn(["ssh", "-G", `${gitRemoteMatch.groups.username}@${gitRemoteMatch.groups.host}`]);
                const port = stdout.split("\n").filter((line) => line.startsWith("port "))[0].split(" ")[1];
                this.remote.host = gitRemoteMatch.groups.host;
                this.remote.group = gitRemoteMatch.groups.group;
                this.remote.project = gitRemoteMatch.groups.project;
                this.remote.schema = "git";
                this.remote.port = port;
            }
        } catch (e) {
            if (e instanceof AssertionError) {
                writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
                return;
            }
            writeStreams.stderr(chalk`{yellow Using fallback git remote data}\n`);
        }
    }

    async initUserData (cwd: string, writeStreams: WriteStreams): Promise<void> {
        const promises = [];

        const gitUsernamePromise = Utils.spawn(["git", "config", "user.name"], cwd).then(({stdout}) => {
            this.user.GITLAB_USER_NAME = stdout.trimEnd();
        }).catch(() => {
            writeStreams.stderr(chalk`{yellow Using fallback git user.name}\n`);
        });
        promises.push(gitUsernamePromise);

        const gitEmailPromise = Utils.spawn(["git", "config", "user.email"], cwd).then(({stdout}) => {
            const email = stdout.trimEnd();
            this.user.GITLAB_USER_EMAIL = email;
            this.user.GITLAB_USER_LOGIN = email.replace(/@.*/, "");
        }).catch(() => {
            writeStreams.stderr(chalk`{yellow Using fallback git user.email}\n`);
        });
        promises.push(gitEmailPromise);

        const osUidPromise = Utils.spawn(["id", "-u"], cwd).then(({stdout}) => {
            this.user.GITLAB_USER_ID = stdout.trimEnd();
        }).catch(() => {
            writeStreams.stderr(chalk`{yellow Using fallback linux user id}\n`);
        });
        promises.push(osUidPromise);

        await Promise.all(promises);
    }
}
