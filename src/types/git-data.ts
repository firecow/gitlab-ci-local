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

    get CI_PROJECT_PATH_SLUG() {
        return `${this.remote.group.replace(/\//g, "-")}-${this.remote.project}`;
    }
}
