import camelCase from "camelcase";
import {GitData} from "./git-data";

type PredefinedVariablesOpts = {
    gitData: GitData;
    argv: {unsetVariables: string[]};
};

export function init ({gitData, argv}: PredefinedVariablesOpts): {[name: string]: string} {
    const predefinedVariables: {[key: string]: string} = {
        GITLAB_USER_LOGIN: gitData.user["GITLAB_USER_LOGIN"],
        GITLAB_USER_EMAIL: gitData.user["GITLAB_USER_EMAIL"],
        GITLAB_USER_NAME: gitData.user["GITLAB_USER_NAME"],
        GITLAB_USER_ID: gitData.user["GITLAB_USER_ID"],
        CI_COMMIT_SHORT_SHA: gitData.commit.SHA.slice(0, 8), // Changes
        CI_COMMIT_SHA: gitData.commit.SHA,
        CI_PROJECT_NAME: gitData.remote.project,
        CI_PROJECT_TITLE: `${camelCase(gitData.remote.project)}`,
        CI_PROJECT_PATH: `${gitData.remote.group}/${gitData.remote.project}`,
        CI_PROJECT_PATH_SLUG: `${gitData.remote.group.replace(/\//g, "-")}-${gitData.remote.project}`.toLowerCase(),
        CI_PROJECT_NAMESPACE: `${gitData.remote.group}`,
        CI_PROJECT_VISIBILITY: "internal",
        CI_PROJECT_ID: "1217",
        CI_COMMIT_REF_PROTECTED: "false",
        CI_COMMIT_BRANCH: gitData.commit.REF_NAME, // Not available in merge request or tag pipelines
        CI_COMMIT_REF_NAME: gitData.commit.REF_NAME, // Tag or branch name
        CI_COMMIT_REF_SLUG: gitData.commit.REF_NAME.replace(/[^a-z\d]+/ig, "-").replace(/^-/, "").slice(0, 63).replace(/-$/, "").toLowerCase(),
        CI_COMMIT_TITLE: "Commit Title", // First line of commit message.
        CI_COMMIT_MESSAGE: "Commit Title\nMore commit text", // Full commit message
        CI_COMMIT_DESCRIPTION: "More commit text",
        CI_DEFAULT_BRANCH: gitData.branches.default,
        CI_PIPELINE_SOURCE: "push",
        CI_SERVER_FQDN: `${gitData.remote.host}`,
        CI_SERVER_HOST: `${gitData.remote.host}`,
        CI_SERVER_PORT: `${gitData.remote.port}`,
        CI_SERVER_URL: `https://${gitData.remote.host}:443`,
        CI_SERVER_PROTOCOL: "https",
        CI_API_V4_URL: `https://${gitData.remote.host}/api/v4`,
        CI_PROJECT_URL: `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}`,
        CI_TEMPLATE_REGISTRY_HOST: "registry.gitlab.com",
        GITLAB_CI: "false",
    };

    // Delete variables the user intentionally wants unset
    for (const unsetVariable of argv.unsetVariables) {
        delete predefinedVariables[unsetVariable];
    }

    return predefinedVariables;
}
