import { Utils } from "./utils";
import { assert } from "./asserts";
import {WriteStreams} from "./types/write-streams";
import chalk from "chalk";
import {ExitError} from "./types/exit-error";

interface GitRemote {
    port: string;
    host: string;
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

    static readonly defaultData: GitData =
        new GitData({
            user: {
                GITLAB_USER_LOGIN: "local",
                GITLAB_USER_EMAIL: "local@gitlab.com",
                GITLAB_USER_NAME: "Bob Local",
                GITLAB_USER_ID: "1000",
            },
            remote: {
                port: "22",
                host: "gitlab.com",
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
        return `local-registry.${this.remote.host}`;
    }

    get CI_REGISTRY_IMAGE() {
        return `${this.CI_REGISTRY}/${this.CI_PROJECT_PATH}`;
    }

    get CI_PROJECT_PATH_SLUG() {
        return `${this.remote.group.replace(/\//g, "-")}-${this.remote.project}`;
    }

    static async init(cwd: string, writeStreams: WriteStreams): Promise<GitData> {
        try {
            const gitVersion = (await Utils.spawn("git --version", cwd)).stdout.trimEnd();
            assert(gitVersion != null, "We do not think it is safe to use git without a proper version string!");
        } catch (e) {
            writeStreams.stderr(chalk`{yellow Git not available using fallback}\n`);
            return this.defaultData;
        }

        return new GitData({
            user: await GitData.getUserData(cwd, writeStreams),
            remote: await GitData.getRemoteData(cwd, writeStreams),
            commit: await GitData.getCommitData(cwd, writeStreams),
        });
    }

    static async getCommitData(cwd: string, writeStreams: WriteStreams): Promise<GitCommit> {
        try {
            const gitLogStdout = (await Utils.spawn("git log -1 --pretty=format:'%h %H %D'", cwd)).stdout.replace(/\r?\n/g, "");
            const gitLogMatch = gitLogStdout.match(/(?<short_sha>\S*?) (?<sha>\S*) .*HEAD( -> |, tag: |, )(?<ref_name>.*?)(?:,|$)/);

            assert(gitLogMatch?.groups != null, "git log -1 didn't provide valid matches");

            return {
                REF_NAME: gitLogMatch.groups.ref_name,
                SHA: gitLogMatch.groups.sha,
                SHORT_SHA: gitLogMatch.groups.short_sha,
            };
        } catch (e) {
            if (e instanceof ExitError) {
                writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
                return this.defaultData.commit;
            }
            writeStreams.stderr(chalk`{yellow Using fallback git commit data}\n`);
            return this.defaultData.commit;
        }
    }

    static async getRemoteData(cwd: string, writeStreams: WriteStreams): Promise<GitRemote> {
        try {
            const { stdout: gitRemote } = await Utils.spawn("git remote -v", cwd);
            const gitRemoteMatch = gitRemote.match(/.*(?:\/\/|@)(?<host>[^:/]*)(:(?<port>\d+)\/|:|\/)(?<group>.*)\/(?<project>.*?)(?:\r?\n|\.git)/);

            assert(gitRemoteMatch?.groups != null, "git remote -v didn't provide valid matches");

            return {
                port: gitRemoteMatch.groups.port ?? "22",
                host: gitRemoteMatch.groups.host,
                group: gitRemoteMatch.groups.group,
                project: gitRemoteMatch.groups.project,
            };
        } catch (e) {
            if (e instanceof ExitError) {
                writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
                return this.defaultData.remote;
            }
            writeStreams.stderr(chalk`{yellow Using fallback git remote data}\n`);
            return this.defaultData.remote;
        }
    }

    static async getUserData(cwd: string, writeStreams: WriteStreams): Promise<GitUser> {
        try {
            const email = (await Utils.spawn("git config user.email", cwd)).stdout.trimEnd();

            return {
                GITLAB_USER_NAME: (await Utils.spawn("git config user.name", cwd)).stdout.trimEnd(),
                GITLAB_USER_ID: (await Utils.spawn("id -u", cwd)).stdout.trimEnd(),
                GITLAB_USER_EMAIL: email,
                GITLAB_USER_LOGIN: email.replace(/@.*/, ""),
            };
        } catch (e) {
            writeStreams.stderr(chalk`{yellow Using fallback git user data}\n`);
            return this.defaultData.user;
        }
    }
}
