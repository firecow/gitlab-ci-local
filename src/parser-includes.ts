import {Utils} from "./utils";
import fetch from "node-fetch";
import {ExitError} from "./types/exit-error";
import * as fs from "fs-extra";
import {WriteStreams} from "./types/write-streams";
import {GitData} from "./git-data";
import {assert} from "./asserts";
import chalk from "chalk";
import {Parser} from "./parser";

export class ParserIncludes {

    static async init(gitlabData: any, cwd: string, writeStreams: WriteStreams, gitData: GitData, fetchIncludes: boolean, depth: number): Promise<any[]> {
        let includeDatas: any[] = [];
        const promises = [];

        assert(depth < 100, chalk`circular dependency detected in \`include\``);
        depth++;

        const include = this.expandInclude(gitlabData["include"]);

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of include) {
            if (!fetchIncludes) {
                continue;
            }
            if (value["local"]) {
                const fileExists = fs.existsSync(`${cwd}/${value["local"]}`);
                if (!fileExists) {
                    throw new ExitError(`Local include file cannot be found ${value["local"]}`);
                }
            } else if (value["file"]) {
                promises.push(this.downloadIncludeProjectFile(cwd, value["project"], value["ref"] || "master", value["file"], gitData.remote.domain));
            } else if (value["template"]) {
                const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
                const url = `https://${domain}/${project}/-/raw/${ref}/${file}`;
                promises.push(this.downloadIncludeRemote(cwd, url));
            } else if (value["remote"]) {
                promises.push(this.downloadIncludeRemote(cwd, value["remote"]));
            }

        }

        await Promise.all(promises);

        for (const value of include) {
            if (value["local"]) {
                const localDoc = await Parser.loadYaml(`${cwd}/${value.local}`);
                includeDatas = includeDatas.concat(await this.init(localDoc, cwd, writeStreams, gitData, fetchIncludes, depth));
            } else if (value["project"]) {
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${gitData.remote.domain}/${value["project"]}/${value["ref"] || "master"}/${value["file"]}`);

                // Expand local includes inside a "project"-like include
                this.expandInclude(fileDoc["include"]).forEach((inner: any, i: number) => {
                    if (!inner["local"]) return;
                    fileDoc["include"][i] = {
                        project: value["project"],
                        file: inner["local"].replace(/^\//, ""),
                        ref: value["ref"],
                    };
                });

                includeDatas = includeDatas.concat(await this.init(fileDoc, cwd, writeStreams, gitData, fetchIncludes, depth));
            } else if (value["template"]) {
                const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
                const fsUrl = Utils.fsUrl(`https://${domain}/${project}/-/raw/${ref}/${file}`);
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${fsUrl}`);
                includeDatas = includeDatas.concat(await this.init(fileDoc, cwd, writeStreams, gitData, fetchIncludes, depth));
            } else if (value["remote"]) {
                const fsUrl = Utils.fsUrl(value["remote"]);
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${fsUrl}`);
                includeDatas = includeDatas.concat(await this.init(fileDoc, cwd, writeStreams, gitData, fetchIncludes, depth));
            } else {
                throw new ExitError(`Didn't understand include ${JSON.stringify(value)}`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }

    static expandInclude(i: any): any[] {
        let include = i || [];
        if (include && include.length == null) {
            include = [ i ];
        }
        if (typeof include === "string") {
            include = [{"local": include}];
        }
        for (const [index, entry] of Object.entries(include)) {
            include[index] = typeof entry === "string" ? {"local": entry } : entry;
        }
        return include;
    }

    static covertTemplateToProjectFile(template: string): { project: string; ref: string; file: string; domain: string } {
        return {
            domain: "gitlab.com",
            project: "gitlab-org/gitlab",
            ref: "master",
            file: `lib/gitlab/ci/templates/${template}`,
        };
    }

    static async downloadIncludeRemote(cwd: string, url: string): Promise<void> {
        const fsUrl = Utils.fsUrl(url);
        const res = await fetch(url);
        if (res.status !== 200) {
            throw new ExitError(`Remote include could not be fetched ${url}`);
        }
        fs.outputFileSync(`${cwd}/.gitlab-ci-local/includes/${fsUrl}`, await res.text());
    }

    static async downloadIncludeProjectFile(cwd: string, project: string, ref: string, file: string, gitRemoteDomain: string): Promise<void> {
        fs.ensureDirSync(`${cwd}/.gitlab-ci-local/includes/${gitRemoteDomain}/${project}/${ref}/`);
        const normalizedFile = file.replace(/^\/+/, "");
        try {
            await Utils.spawn(`git archive --remote=git@${gitRemoteDomain}:${project}.git ${ref} ${normalizedFile} | tar -f - -xC .gitlab-ci-local/includes/${gitRemoteDomain}/${project}/${ref}/`, cwd);
        } catch (e) {
            throw new ExitError(`Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${normalizedFile} }`);
        }
    }
}
