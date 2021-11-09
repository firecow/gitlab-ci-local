import {Utils} from "./utils";
import * as fs from "fs-extra";
import {ExitError} from "./types/exit-error";
import {assert} from "./asserts";

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

    readonly remote: GitRemote;
    readonly commit: GitCommit;
    readonly user: GitUser;

    constructor(data: {remote: GitRemote; commit: GitCommit; user: GitUser}) {
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
        let gitlabUserEmail, gitlabUserName, gitlabUserId;

        try {
            const {stdout: gitConfigEmail} = await Utils.spawn("git config user.email", cwd);
            gitlabUserEmail = gitConfigEmail.trimEnd();
        } catch (e) {
            gitlabUserEmail = "local@gitlab.com";
        }
        const gitlabUserLogin = gitlabUserEmail.replace(/@.*/, "");
        try {
            const {stdout: gitConfigUserName} = await Utils.spawn("git config user.name", cwd);
            gitlabUserName = gitConfigUserName.trimEnd();
        } catch (e) {
            gitlabUserName = "Bob Local";
        }

        try {
            const {stdout: shellgitlabUserId} = await Utils.spawn("id -u");
            gitlabUserId = shellgitlabUserId.trimEnd();
        } catch (e) {
            gitlabUserId = "1000";
        }

        let gitConfig;
        if (fs.existsSync(`${cwd}/.git/config`)) {
            gitConfig = fs.readFileSync(`${cwd}/.git/config`, "utf8");
        } else if (fs.existsSync(`${cwd}/.gitconfig`)) {
            gitConfig = fs.readFileSync(`${cwd}/.gitconfig`, "utf8");
        } else {
            throw new ExitError("Could not locate.gitconfig or .git/config file");
        }
        const gitRemoteMatch = gitConfig.match(/url = .*(?:http[s]?:\/\/|@)(?<domain>.*?)[:|/](?<group>.*)\/(?<project>.*?)(?:\r?\n|\.git)/);
        assert(gitRemoteMatch?.groups != null, "git config didn't provide valid matches");
        assert(gitRemoteMatch.groups.domain != null, "<domain> not found in git config");
        assert(gitRemoteMatch.groups.group != null, "<group> not found in git config");
        assert(gitRemoteMatch.groups.project != null, "<project> not found in git config");

        const {stdout: gitLogStdout} = await Utils.spawn("git log -1 --pretty=format:'%h %H %D'", cwd);
        const gitLogOutput = gitLogStdout.replace(/\r?\n/g, "");
        let gitLogMatch;
        if (gitLogOutput.match(/HEAD, tag/)) {
            gitLogMatch = gitLogOutput.match(/(?<short_sha>.*?) (?<sha>.*?) HEAD, tag: (?<ref_name>.*?),/);
        } else {
            gitLogMatch = gitLogOutput.match(/(?<short_sha>.*?) (?<sha>.*?) HEAD -> (?<ref_name>.*?)(?:,|$)/);
        }
        assert(gitLogMatch?.groups != null, "git log -1 didn't provide valid matches");
        assert(gitLogMatch.groups.ref_name != null, "<ref_name> not found in git log -1");
        assert(gitLogMatch.groups.sha != null, "<sha> not found in git log -1");
        assert(gitLogMatch.groups.short_sha != null, "<short_sha> not found in git log -1");

        return new GitData({
            user: {
                GITLAB_USER_LOGIN: gitlabUserLogin,
                GITLAB_USER_EMAIL: gitlabUserEmail,
                GITLAB_USER_NAME: gitlabUserName,
                GITLAB_USER_ID: gitlabUserId,
            },
            remote: {
                domain: gitRemoteMatch.groups.domain,
                group: gitRemoteMatch.groups.group,
                project: gitRemoteMatch.groups.project,
            },
            commit: {
                REF_NAME: gitLogMatch.groups.ref_name,
                SHA: gitLogMatch.groups.sha,
                SHORT_SHA: gitLogMatch.groups.short_sha,
            },
        });
    }
}
