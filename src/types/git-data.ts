export interface GitData {
    remote: {
        domain: string;
        group: string;
        project: string;
    };

    commit: {
        SHA: string;
        SHORT_SHA: string;
        REF_NAME: string;
    };

    user: {
        GITLAB_USER_EMAIL: string;
        GITLAB_USER_LOGIN: string;
        GITLAB_USER_NAME: string;
    };
}
