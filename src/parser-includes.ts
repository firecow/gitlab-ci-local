import {Utils} from "./utils";
import fs from "fs-extra";
import {WriteStreams} from "./write-streams";
import {GitData} from "./git-data";
import assert, {AssertionError} from "assert";
import chalk from "chalk";
import {Parser} from "./parser";
import axios from "axios";
import globby from "globby";
import path from "path";

type ParserIncludesInitOptions = {
    cwd: string;
    stateDir: string;
    writeStreams: WriteStreams;
    gitData: GitData;
    fetchIncludes: boolean;
    variables: {[key: string]: string};
    expandVariables: boolean;
    maximumIncludes: number;
};

export class ParserIncludes {
    private static count: number = 0;

    static resetCount (): void {
        this.count = 0;
    }

    static async init (gitlabData: any, opts: ParserIncludesInitOptions): Promise<any[]> {
        this.count++;
        assert(
            this.count <= opts.maximumIncludes + 1, // 1st init call is not counted
            chalk`This GitLab CI configuration is invalid: Maximum of {blueBright ${opts.maximumIncludes}} nested includes are allowed!. This limit can be increased with the --maximum-includes cli flags.`
        );
        let includeDatas: any[] = [];
        const promises = [];
        const {stateDir, cwd, fetchIncludes, gitData, expandVariables} = opts;

        const include = this.expandInclude(gitlabData?.include, opts.variables);

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of include) {
            if (value["rules"]) {
                const include_rules = value["rules"];
                const rulesResult = Utils.getRulesResult({cwd, rules: include_rules, variables: opts.variables}, gitData);
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                validateIncludeLocal(value["local"]);
                const files = await globby(value["local"].replace(/^\//, ""), {dot: true, cwd});
                if (files.length == 0) {
                    throw new AssertionError({message: `Local include file cannot be found ${value["local"]}`});
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
                const rulesResult = Utils.getRulesResult({cwd, rules: include_rules, variables: opts.variables}, gitData);
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                const files = await globby([value["local"].replace(/^\//, "")], {dot: true, cwd});
                for (const localFile of files) {
                    const content = await Parser.loadYaml(`${cwd}/${localFile}`, {inputs: value.inputs || {}}, expandVariables);
                    includeDatas = includeDatas.concat(await this.init(content, opts));
                }
            } else if (value["project"]) {
                for (const fileValue of Array.isArray(value["file"]) ? value["file"] : [value["file"]]) {
                    const fileDoc = await Parser.loadYaml(
                        `${cwd}/${stateDir}/includes/${gitData.remote.host}/${value["project"]}/${value["ref"] || "HEAD"}/${fileValue}`
                        , {inputs: value.inputs || {}}
                        , expandVariables);
                    // Expand local includes inside a "project"-like include
                    fileDoc["include"] = this.expandInclude(fileDoc["include"], opts.variables);
                    fileDoc["include"].forEach((inner: any, i: number) => {
                        if (!inner["local"]) return;
                        fileDoc["include"][i] = {
                            project: value["project"],
                            file: inner["local"].replace(/^\//, ""),
                            ref: value["ref"],
                            inputs: inner.inputs || {},
                        };
                    });

                    includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
                }
            } else if (value["component"]) {
                const {domain, port, projectPath, componentName, ref} = this.parseIncludeComponent(value["component"]);
                // converts component to project
                const files = [`${componentName}.yml`, `${componentName}/template.yml`, null];

                for (const f of files) {
                    assert(f !== null, `This GitLab CI configuration is invalid: component: \`${value["component"]}\`. One of the files [${files}] must exist in \`${domain}:${port}/${projectPath}\``);

                    const isLocalComponent = projectPath === `${gitData.remote.group}/${gitData.remote.project}` && ref === gitData.commit.SHA;
                    if (isLocalComponent) {
                        const localComponentInclude = `${cwd}/${f}`;
                        if (!(await fs.pathExists(localComponentInclude))) {
                            continue;
                        }

                        const content = await Parser.loadYaml(localComponentInclude, {inputs: value.inputs || {}}, expandVariables);
                        includeDatas = includeDatas.concat(await this.init(content, opts));
                        break;
                    } else {
                        if (!(await Utils.remoteFileExist(cwd, f, ref, domain, projectPath, gitData.remote.schema, gitData.remote.port))) {
                            continue;
                        }

                        const fileDoc = {
                            include: {
                                project: projectPath,
                                file: f,
                                ref: ref,
                                inputs: value.inputs || {},
                            },
                        };
                        includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
                    }
                    break;
                }
            } else if (value["template"]) {
                const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
                const fsUrl = Utils.fsUrl(`https://${domain}/${project}/-/raw/${ref}/${file}`);
                const fileDoc = await Parser.loadYaml(
                    `${cwd}/${stateDir}/includes/${fsUrl}`, {inputs: value.inputs || {}}, expandVariables
                );
                includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
            } else if (value["remote"]) {
                const fsUrl = Utils.fsUrl(value["remote"]);
                const fileDoc = await Parser.loadYaml(
                    `${cwd}/${stateDir}/includes/${fsUrl}`, {inputs: value.inputs || {}}, expandVariables
                );
                includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
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

    static parseIncludeComponent (component: string): {domain: string; port: string; projectPath: string; componentName: string; ref: string} {
        assert(!component.includes("://"), `This GitLab CI configuration is invalid: component: \`${component}\` should not contain protocol`);
        // eslint-disable-next-line no-useless-escape
        const pattern = /(?<domain>[^/:\s]+)(:(?<port>[0-9]+))?\/(?<projectPath>.+)\/(?<componentName>[^@]+)@(?<ref>.+)/; // https://regexr.com/86q5d
        const gitRemoteMatch = pattern.exec(component);

        if (gitRemoteMatch?.groups == null) throw new Error(`This is a bug, please create a github issue if this is something you're expecting to work. input: ${component}`);
        return {
            domain: gitRemoteMatch.groups["domain"],
            port: gitRemoteMatch.groups["port"],
            projectPath: gitRemoteMatch.groups["projectPath"],
            componentName: `templates/${gitRemoteMatch.groups["componentName"]}`,
            ref: gitRemoteMatch.groups["ref"],
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

    static async downloadIncludeProjectFile (cwd: string, stateDir: string, project: string, ref: string, file: string, gitData: GitData, fetchIncludes: boolean): Promise<void> {
        const remote = gitData.remote;
        const normalizedFile = file.replace(/^\/+/, "");
        try {
            const target = `${stateDir}/includes/${remote.host}/${project}/${ref}`;
            if (await fs.pathExists(`${cwd}/${target}/${normalizedFile}`) && !fetchIncludes) return;

            if (remote.schema.startsWith("http")) {
                const ext = "tmp-" + Math.random();
                await fs.mkdirp(path.dirname(`${cwd}/${target}/${normalizedFile}`));
                await Utils.bash(`
                    cd ${cwd}/${stateDir} \\
                        && git clone --branch "${ref}" -n --depth=1 --filter=tree:0 \\
                                ${remote.schema}://${remote.host}:${remote.port}/${project}.git \\
                                ${cwd}/${target}.${ext} \\
                        && cd ${cwd}/${target}.${ext} \\
                        && git sparse-checkout set --no-cone ${normalizedFile} \\
                        && git checkout \\
                        && cd ${cwd}/${stateDir} \\
                        && cp ${cwd}/${target}.${ext}/${normalizedFile} \\
                              ${cwd}/${target}/${normalizedFile}
                    `, cwd);
            } else {
                await fs.mkdirp(`${cwd}/${target}`);
                await Utils.bash(`set -eou pipefail; git archive --remote=ssh://git@${remote.host}:${remote.port}/${project}.git ${ref} ${normalizedFile} | tar -f - -xC ${target}/`, cwd);
            }
        } catch (e) {
            throw new AssertionError({message: `Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${normalizedFile} }\n${e}`});
        }
    }
}

function validateIncludeLocal (filePath: string) {
    assert(!filePath.startsWith("./"), `\`${filePath}\` for include:local is invalid. Gitlab does not support relative path (ie. cannot start with \`./\`).`);
    assert(!filePath.includes(".."), `\`${filePath}\` for include:local is invalid. Gitlab does not support directory traversal.`);
}
