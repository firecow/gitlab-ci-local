import { Utils } from "./utils";
import * as fs from "fs-extra";
import { ExitError } from "./types/exit-error";
import { assert } from "./asserts";

interface GitRemote {
    domain: string;
    group: string;
    project: string;
}

interface GitCommit {
    SHA: string;
    SHORT_SHA: string;
    REF_NAME: string;
}

interface GitUser {
    GITLAB_USER_EMAIL: string;
    GITLAB_USER_LOGIN: string;
    GITLAB_USER_NAME: string;
    GITLAB_USER_ID: string;
}

export class GitData {

    static readonly GIT_COMMAND_USER_EMAIL: string = "git config user.email";
    static readonly GIT_COMMAND_USER_USERNAME: string = "git config user.name";
    static readonly GIT_COMMAND_REMOTE: string = "git remote -v";
    static readonly GIT_COMMAND_COMMIT: string = "git log -1 --pretty=format:'%h %H %D'";
    static readonly GIT_COMMAND_AVAILABILITY: string = "git --version";
  
    static readonly defaultData: GitData =
        new GitData({
            user: {
                GITLAB_USER_LOGIN: "local",
                GITLAB_USER_EMAIL: "local@gitlab.com",
                GITLAB_USER_NAME: "Bob Local",
                GITLAB_USER_ID: "1000",
            },
            remote: {
                domain: "fallback.domain",
                group: "fallback.group",
                project: "fallback.project",
            },
            commit: {
                REF_NAME: "main",
                SHA: "0000000000000000000000000000000000000000",
                SHORT_SHA: "00000000",
            },
        });

    readonly remote: GitRemote;
    readonly commit: GitCommit;
    readonly user: GitUser;

    constructor(data: { remote: GitRemote; commit: GitCommit; user: GitUser }) {
        this.remote = data.remote;
        this.commit = data.commit;
        this.user = data.user;
    }

    get CI_PROJECT_PATH() {
        return `${this.remote.group}/${this.remote.project}`;
    }

    get CI_REGISTRY() {
        return `local-registry.${this.remote.domain}`;
    }

    get CI_REGISTRY_IMAGE() {
        return `${this.CI_REGISTRY}/${this.CI_PROJECT_PATH}`;
    }

    get CI_PROJECT_PATH_SLUG() {
        return `${this.remote.group.replace(/\//g, "-")}-${this.remote.project}`;
    }

    static async init(cwd: string): Promise<GitData> {
        try {
            const { stdout: gitVersion } = await Utils.spawn(this.GIT_COMMAND_AVAILABILITY, cwd);
            assert(gitVersion != null, "We do not think it is safe to use git without a proper version string!")
        } catch (e) {
            console.info("Git not available using fallback", e)
            return this.defaultData
        }

        return new GitData({
            user: await GitData.getUserData(cwd),
            remote: await GitData.getRemoteData(cwd),
            commit: await GitData.getCommitData(cwd)
        });
    }

    static async getCommitData(cwd: string): Promise<GitCommit> {
        try {
            const { stdout: gitLogStdout } = await Utils.spawn(this.GIT_COMMAND_COMMIT, cwd);
            const gitLogOutput = gitLogStdout.replace(/\r?\n/g, "");
            let gitLogMatch = gitLogOutput.match(/(?<short_sha>\S*?) (?<sha>\S*) .*HEAD( -> |, tag: |, )(?<ref_name>.*?)(?:,|$)/);

            assert(gitLogMatch?.groups != null, "git log -1 didn't provide valid matches");
            let commit = {} as GitCommit;
            commit.REF_NAME = gitLogMatch.groups.ref_name
            commit.SHA = gitLogMatch.groups.sha
            commit.SHORT_SHA = gitLogMatch.groups.short_sha
            return commit
        } catch (e) {
            console.info("Using fallback git commit data, as we could not resolve correct data.")
            return this.defaultData.commit
        }
    }

    static async getRemoteData(cwd: string): Promise<GitRemote> {
        try {
            const { stdout: gitRemote } = await Utils.spawn(this.GIT_COMMAND_REMOTE, cwd);
            const gitRemoteMatch = gitRemote.match(/.*(?:http[s]?:\/\/|@)(?<domain>.*?)[:|/](?<group>.*)\/(?<project>.*?)(?:\r?\n|\.git)/);
            assert(gitRemoteMatch?.groups != null, "git remote -v didn't provide valid matches");
            let remote = {} as GitRemote;
            remote.domain = gitRemoteMatch.groups.domain;
            remote.group = gitRemoteMatch.groups.group;
            remote.project = gitRemoteMatch.groups.project;
            return remote
        } catch (e) {
            console.info("Using fallback remote data");
            return this.defaultData.remote
        }
    }

    static async getUserData(cwd: string): Promise<GitUser> {
        try {
            const { stdout: gitConfigEmail } = await Utils.spawn(this.GIT_COMMAND_USER_EMAIL, cwd);
            const mail = gitConfigEmail.trimEnd();
            let user = {} as GitUser;
            user.GITLAB_USER_EMAIL = mail;
            user.GITLAB_USER_LOGIN = mail.replace(/@.*/, "");
            const { stdout: gitConfigUserName } = await Utils.spawn(this.GIT_COMMAND_USER_USERNAME, cwd);
            user.GITLAB_USER_NAME = gitConfigUserName.trimEnd();
            const { stdout: gitUserId } = await Utils.spawn('id -u', cwd);
            user.GITLAB_USER_ID = gitUserId.trimEnd();
            return user;
        } catch (e) {
            console.info("Using fallback data for user")
            return this.defaultData.user
        }
    }
}
