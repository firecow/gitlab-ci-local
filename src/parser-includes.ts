import {Utils} from "./utils";
import {ExitError} from "./exit-error";
import * as fs from "fs-extra";
import {WriteStreams} from "./write-streams";
import {GitData} from "./git-data";
import {assert} from "./asserts";
import chalk from "chalk";
import {Parser} from "./parser";
import axios from "axios";
import globby from "globby";
import camelCase from "camelcase";

type ParserIncludesInitOptions = {
    cwd: string;
    stateDir: string;
    writeStreams: WriteStreams;
    gitData: GitData;
    fetchIncludes: boolean;
    excludedGlobs: string[];
};

export class ParserIncludes {

    static async init (gitlabData: any, depth: number, opts: ParserIncludesInitOptions): Promise<any[]> {
        let includeDatas: any[] = [];
        const promises = [];
        const {stateDir, cwd, fetchIncludes, gitData, excludedGlobs} = opts;

        assert(depth < 100, chalk`circular dependency detected in \`include\``);
        depth++;

        const include = this.expandInclude(gitlabData["include"]);

        const predefinedVariables = {
            GITLAB_USER_LOGIN: gitData.user["GITLAB_USER_LOGIN"],
            GITLAB_USER_EMAIL: gitData.user["GITLAB_USER_EMAIL"],
            GITLAB_USER_NAME: gitData.user["GITLAB_USER_NAME"],
            GITLAB_USER_ID: gitData.user["GITLAB_USER_ID"],
            CI_COMMIT_SHORT_SHA: gitData.commit.SHORT_SHA, // Changes
            CI_COMMIT_SHA: gitData.commit.SHA,
            CI_PROJECT_NAME: gitData.remote.project,
            CI_PROJECT_TITLE: `${camelCase(gitData.remote.project)}`,
            CI_PROJECT_PATH: gitData.CI_PROJECT_PATH,
            CI_PROJECT_PATH_SLUG: gitData.CI_PROJECT_PATH_SLUG,
            CI_PROJECT_NAMESPACE: `${gitData.remote.group}`,
            CI_PROJECT_VISIBILITY: "internal",
            CI_PROJECT_ID: "1217",
            CI_COMMIT_REF_PROTECTED: "false",
            CI_COMMIT_BRANCH: gitData.commit.REF_NAME, // Not available in merge request or tag pipelines
            CI_COMMIT_REF_NAME: gitData.commit.REF_NAME, // Tag or branch name
            CI_COMMIT_REF_SLUG: gitData.commit.REF_NAME.replace(/[^a-z\d]+/ig, "-").replace(/^-/, "").replace(/-$/, "").slice(0, 63).toLowerCase(),
            CI_COMMIT_TITLE: "Commit Title", // First line of commit message.
            CI_COMMIT_MESSAGE: "Commit Title\nMore commit text", // Full commit message
            CI_COMMIT_DESCRIPTION: "More commit text",
            CI_PIPELINE_SOURCE: "push",
            CI_SERVER_HOST: `${gitData.remote.host}`,
            CI_SERVER_PORT: `${gitData.remote.port}`,
            CI_SERVER_URL: `https://${gitData.remote.host}:443`,
            CI_SERVER_PROTOCOL: "https",
            CI_API_V4_URL: `https://${gitData.remote.host}/api/v4`,
            CI_PROJECT_URL: `https://${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}`,
            CI_JOB_NAME: `${this.name}`,
            CI_REGISTRY: gitData.CI_REGISTRY,
            CI_REGISTRY_IMAGE: gitData.CI_REGISTRY_IMAGE,
            GITLAB_CI: "false",
        };

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of include) {
            if (value["rules"]) {
                const include_rules = value["rules"];
                const rulesResult = Utils.getRulesResult({cwd, rules: include_rules, variables: predefinedVariables});
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                const files = await globby(value["local"], {dot: true, cwd});
                if (files.length == 0) {
                    throw new ExitError(`Local include file cannot be found ${value["local"]}`);
                }
            } else if (value["file"]) {
                for (const fileValue of Array.isArray(value["file"]) ? value["file"] : [value["file"]]) {
                    promises.push(this.downloadIncludeProjectFile(cwd, stateDir, value["project"], value["ref"] || "HEAD", fileValue, gitData, fetchIncludes));
                }
            } else if (value["template"]) {
                const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
                const url = `https://${domain}/${project}/-/raw/${ref}/${file}`;
                promises.push(this.downloadIncludeRemote(cwd, stateDir, url, fetchIncludes));
            } else if (value["remote"]) {
                promises.push(this.downloadIncludeRemote(cwd, stateDir, value["remote"], fetchIncludes));
            }

        }

        await Promise.all(promises);

        for (const value of include) {
            if (value["rules"]) {
                const include_rules = value["rules"];
                const rulesResult = Utils.getRulesResult({cwd, rules: include_rules, variables: predefinedVariables});
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                const files = await globby([value["local"], ...excludedGlobs], {dot: true, cwd});
                for (const localFile of files) {
                    const content = await Parser.loadYaml(`${cwd}/${localFile}`);
                    excludedGlobs.push(`!${localFile}`);
                    includeDatas = includeDatas.concat(await this.init(content, depth, opts));
                }
            } else if (value["project"]) {
                for (const fileValue of Array.isArray(value["file"]) ? value["file"] : [value["file"]]) {
                    const fileDoc = await Parser.loadYaml(`${cwd}/${stateDir}/includes/${gitData.remote.host}/${value["project"]}/${value["ref"] || "HEAD"}/${fileValue}`);

                    // Expand local includes inside a "project"-like include
                    fileDoc["include"] = this.expandInclude(fileDoc["include"]);
                    fileDoc["include"].forEach((inner: any, i: number) => {
                        if (!inner["local"]) return;
                        fileDoc["include"][i] = {
                            project: value["project"],
                            file: inner["local"].replace(/^\//, ""),
                            ref: value["ref"],
                        };
                    });

                    includeDatas = includeDatas.concat(await this.init(fileDoc, depth, opts));
                }
            } else if (value["template"]) {
                const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
                const fsUrl = Utils.fsUrl(`https://${domain}/${project}/-/raw/${ref}/${file}`);
                const fileDoc = await Parser.loadYaml(`${cwd}/${stateDir}/includes/${fsUrl}`);
                includeDatas = includeDatas.concat(await this.init(fileDoc, depth, opts));
            } else if (value["remote"]) {
                const fsUrl = Utils.fsUrl(value["remote"]);
                const fileDoc = await Parser.loadYaml(`${cwd}/${stateDir}/includes/${fsUrl}`);
                includeDatas = includeDatas.concat(await this.init(fileDoc, depth, opts));
            } else {
                throw new ExitError(`Didn't understand include ${JSON.stringify(value)}`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }

    static expandInclude (i: any): any[] {
        let include = i || [];
        if (include && include.length == null) {
            include = [ i ];
        }
        if (typeof include === "string") {
            include = [include];
        }
        for (const [index, entry] of Object.entries(include)) {
            if (typeof entry === "string" && (entry.startsWith("https:") || entry.startsWith("http:"))) {
                include[index] = {"remote": entry};
            } else if (typeof entry === "string") {
                include[index] = {"local": entry};
            } else {
                include[index] = entry;
            }

        }
        return include;
    }

    static covertTemplateToProjectFile (template: string): {project: string; ref: string; file: string; domain: string} {
        return {
            domain: "gitlab.com",
            project: "gitlab-org/gitlab",
            ref: "HEAD",
            file: `lib/gitlab/ci/templates/${template}`,
        };
    }

    static async downloadIncludeRemote (cwd: string, stateDir: string, url: string, fetchIncludes: boolean): Promise<void> {
        const fsUrl = Utils.fsUrl(url);
        try {
            const target = `${cwd}/${stateDir}/includes/${fsUrl}`;
            if (await fs.pathExists(target) && !fetchIncludes) return;
            const res = await axios.get(url);
            await fs.outputFile(target, res.data);
        } catch (e) {
            throw new ExitError(`Remote include could not be fetched ${url} ${e}`);
        }
    }

    static async downloadIncludeProjectFile (cwd: string, stateDir: string, project: string, ref: string, file: string, gitData: GitData, fetchIncludes: boolean): Promise<void> {
        const remote = gitData.remote;
        const normalizedFile = file.replace(/^\/+/, "");
        try {
            const target = `${stateDir}/includes/${remote.host}/${project}/${ref}/`;
            if (await fs.pathExists(`${cwd}/${target}/${normalizedFile}`) && !fetchIncludes) return;
            await fs.mkdirp(`${cwd}/${target}`);
            await Utils.bash(`git archive --remote=ssh://git@${remote.host}:${remote.port}/${project}.git ${ref} ${normalizedFile} | tar -f - -xC ${target}`, cwd);
        } catch (e) {
            throw new ExitError(`Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${normalizedFile} }`);
        }
    }
}
