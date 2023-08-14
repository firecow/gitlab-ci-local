import {Utils} from "./utils";
import fs from "fs-extra";
import {WriteStreams} from "./write-streams";
import {GitData} from "./git-data";
import assert, {AssertionError} from "assert";
import chalk from "chalk";
import {Parser} from "./parser";
import axios from "axios";
import globby from "globby";

type ParserIncludesInitOptions = {
    cwd: string;
    stateDir: string;
    writeStreams: WriteStreams;
    gitData: GitData;
    fetchIncludes: boolean;
    useSparseCheckout: boolean;
    excludedGlobs: string[];
    variables: {[key: string]: string};
};

export class ParserIncludes {

    static async init (gitlabData: any, depth: number, opts: ParserIncludesInitOptions): Promise<any[]> {
        let includeDatas: any[] = [];
        const promises = [];
        const {stateDir, cwd, fetchIncludes, gitData, excludedGlobs, useSparseCheckout} = opts;

        assert(depth < 100, chalk`circular dependency detected in \`include\``);
        depth++;

        const include = this.expandInclude(gitlabData["include"], opts.variables);

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of include) {
            if (value["rules"]) {
                const include_rules = value["rules"];
                const rulesResult = Utils.getRulesResult({cwd, rules: include_rules, variables: opts.variables});
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                const files = await globby(value["local"].replace(/^\//, ""), {dot: true, cwd});
                if (files.length == 0) {
                    throw new AssertionError({message: `Local include file cannot be found ${value["local"]}`});
                }
            } else if (value["file"]) {
                for (const fileValue of Array.isArray(value["file"]) ? value["file"] : [value["file"]]) {
                    promises.push(this.downloadIncludeProjectFile(cwd, stateDir, value["project"], value["ref"] || "HEAD", fileValue, gitData, fetchIncludes, useSparseCheckout));
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
                const rulesResult = Utils.getRulesResult({cwd, rules: include_rules, variables: opts.variables});
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                const files = await globby([value["local"].replace(/^\//, ""), ...excludedGlobs], {dot: true, cwd});
                for (const localFile of files) {
                    const content = await Parser.loadYaml(`${cwd}/${localFile}`);
                    excludedGlobs.push(`!${localFile}`);
                    includeDatas = includeDatas.concat(await this.init(content, depth, opts));
                }
            } else if (value["project"]) {
                for (const fileValue of Array.isArray(value["file"]) ? value["file"] : [value["file"]]) {
                    const fileDoc = await Parser.loadYaml(`${cwd}/${stateDir}/includes/${gitData.remote.host}/${value["project"]}/${value["ref"] || "HEAD"}/${fileValue}`);

                    // Expand local includes inside a "project"-like include
                    fileDoc["include"] = this.expandInclude(fileDoc["include"], opts.variables);
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
                throw new AssertionError({message: `Didn't understand include ${JSON.stringify(value)}`});
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }

    static expandInclude (i: any, variables: {[key: string]: string}): any[] {
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

        for (const entry of include) {
            for (const [key, value] of Object.entries(entry)) {
                entry[key] = Utils.expandText(value, variables);
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
            throw new AssertionError({message: `Remote include could not be fetched ${url}\n${e}`});
        }
    }

    static async downloadIncludeProjectFile (cwd: string, stateDir: string, project: string, ref: string, file: string, gitData: GitData, fetchIncludes: boolean, useSparseCheckout: boolean): Promise<void> {
        const remote = gitData.remote;
        const normalizedFile = file.replace(/^\/+/, "");
        try {
            const target = `${stateDir}/includes/${remote.host}/${project}/${ref}`;

            if (await fs.pathExists(`${cwd}/${target}/${normalizedFile}`) && !fetchIncludes) return;

            if (!useSparseCheckout) {
                const p = await Utils.bash("git config --get remote.origin.url");
                useSparseCheckout = p.stdout.startsWith("http");
            }

            if (useSparseCheckout) {
                const ext = "tmp-" + Math.random();
                await fs.ensureFile(`${cwd}/${target}/${normalizedFile}`);
                await Utils.bash(`
                  cd ${cwd}; git clone -n --depth=1 --filter=tree:0 https://${remote.host}/${project}.git ${cwd}/${target}.${ext}  ;\
                  cd ${cwd}/${target}.${ext} ;\
                  git sparse-checkout set --no-cone ${normalizedFile}  ;\
                  git checkout ; cd ..; cp ${cwd}/${target}.${ext}/${normalizedFile} ${cwd}/${target}/${normalizedFile};
                `, cwd);
            } else {
                await fs.mkdirp(`${cwd}/${target}`);
                await Utils.bash(`git archive --remote=ssh://git@${remote.host}:${remote.port}/${project}.git ${ref} ${normalizedFile} | tar -f - -xC ${target}`, cwd);
            }
        } catch (e) {
            throw new AssertionError({message: `Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${normalizedFile} }\n${e}`});
        }
    }
}
