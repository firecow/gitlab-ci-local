import {Utils} from "./utils";
import {assert} from "./asserts";
import {WriteStreams} from "./types/write-streams";
import chalk from "chalk";
import {ExitError} from "./types/exit-error";
import {isInTabCompletionMode} from "./tab-completion-mode";

export class GitData {

    public readonly user = {
        GITLAB_USER_LOGIN: "local",
        GITLAB_USER_EMAIL: "local@gitlab.com",
        GITLAB_USER_NAME: "Bob Local",
        GITLAB_USER_ID: "1000",
    };

    public readonly remote = {
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
        const gitData = new GitData();
        try {
            const gitVersion = (await Utils.spawn("git --version", cwd)).stdout.trimEnd();
            assert(gitVersion != null, "We do not think it is safe to use git without a proper version string!");
        } catch (e) {
            if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow Git not available using fallback}\n`);
            return gitData;
        }
        await gitData.initCommitData(cwd, writeStreams);
        await gitData.initRemoteData(cwd, writeStreams);
        await gitData.initUserData(cwd, writeStreams);
        return gitData;
    }

    private async initCommitData(cwd: string, writeStreams: WriteStreams): Promise<void> {
        try {
            const gitLogStdout = (await Utils.spawn("git log -1 --pretty=format:'%h %H %D'", cwd)).stdout.replace(/\r?\n/g, "");
            const gitLogMatch = gitLogStdout.match(/(?<short_sha>\S*?) (?<sha>\S*) .*HEAD( -> |, tag: |, )(?<ref_name>.*?)(?:,|$)/);

            assert(gitLogMatch?.groups != null, "git log -1 didn't provide valid matches");

            this.commit.REF_NAME = gitLogMatch.groups.ref_name;
            this.commit.SHA = gitLogMatch.groups.sha;
            this.commit.SHORT_SHA = gitLogMatch.groups.short_sha;
        } catch (e) {
            if (e instanceof ExitError) {
                if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
                return;
            }
            if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow Using fallback git commit data}\n`);
        }
    }

    private async initRemoteData(cwd: string, writeStreams: WriteStreams): Promise<void> {
        try {
            const { stdout: gitRemote } = await Utils.spawn("git remote -v", cwd);
            const gitRemoteMatch = gitRemote.match(/.*(?:\/\/|@)(?<host>[^:/]*)(:(?<port>\d+)\/|:|\/)(?<group>.*)\/(?<project>.*?)(?:\r?\n|\.git)/);

            assert(gitRemoteMatch?.groups != null, "git remote -v didn't provide valid matches");

            this.remote.port = gitRemoteMatch.groups.port ?? "22";
            this.remote.host = gitRemoteMatch.groups.host;
            this.remote.group = gitRemoteMatch.groups.group;
            this.remote.project = gitRemoteMatch.groups.project;
        } catch (e) {
            if (e instanceof ExitError) {
                if (!isInTabCompletionMode())  writeStreams.stderr(chalk`{yellow ${e.message}}\n`);
                return;
            }
            if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow Using fallback git remote data}\n`);
        }
    }

    async initUserData(cwd: string, writeStreams: WriteStreams): Promise<void> {
        try {
            this.user.GITLAB_USER_NAME = (await Utils.spawn("git config user.name", cwd)).stdout.trimEnd();
        } catch(e) {
            if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow Using fallback git user.name}\n`);
        }

        try {
            const email = (await Utils.spawn("git config user.email", cwd)).stdout.trimEnd();
            this.user.GITLAB_USER_EMAIL = email;
            this.user.GITLAB_USER_LOGIN = email.replace(/@.*/, "");
        } catch (e) {
            if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow Using fallback git user.email}\n`);
        }

        try {
            this.user.GITLAB_USER_ID = (await Utils.spawn("id -u", cwd)).stdout.trimEnd();
        } catch(e) {
            if (!isInTabCompletionMode()) writeStreams.stderr(chalk`{yellow Using fallback linux user id}\n`);
        }
    }
}
