import {Argv} from "./argv.js";
import {Utils} from "./utils.js";
import fs from "fs-extra";
import {WriteStreams} from "./write-streams.js";
import {GitData} from "./git-data.js";
import assert, {AssertionError} from "assert";
import chalk from "chalk";
import {Parser} from "./parser.js";
import axios, {AxiosRequestConfig} from "axios";
import path from "path";
import semver from "semver";
import {RE2JS} from "re2js";

type ParserIncludesInitOptions = {
    argv: Argv;
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

    private static normalizeTriggerInclude (gitlabData: any, opts: ParserIncludesInitOptions) {
        const {writeStreams} = opts;
        for (const [jobName, jobData] of Object.entries<any>(gitlabData ?? {})) {
            if (typeof jobData.trigger?.include === "string") {
                jobData.trigger.include = [{
                    local: jobData.trigger.include,
                } ];
            } else if (jobData.trigger?.project) {
                writeStreams.memoStdout(chalk`{bgYellowBright  WARN } The job: \`{blueBright ${jobName}}\` will be no-op. Multi-project pipeline is not supported by gitlab-ci-local\n`);
            }
        }
    }

    static async init (gitlabData: any, opts: ParserIncludesInitOptions): Promise<any[]> {
        const {argv} = opts;
        this.count++;
        assert(
            this.count <= opts.maximumIncludes + 1, // 1st init call is not counted
            chalk`This GitLab CI configuration is invalid: Maximum of {blueBright ${opts.maximumIncludes}} nested includes are allowed!. This limit can be increased with the --maximum-includes cli flags.`,
        );
        let includeDatas: any[] = [];
        const promises = [];
        const {stateDir, cwd, fetchIncludes, gitData, expandVariables} = opts;

        const include = this.expandInclude(gitlabData?.include, opts.variables);

        this.normalizeTriggerInclude(gitlabData, opts);
        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of include) {
            if (value["rules"]) {
                const include_rules = value["rules"];
                const rulesResult = Utils.getRulesResult({argv, cwd, rules: include_rules, variables: opts.variables}, gitData);
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["file"]) {
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
                const rulesResult = Utils.getRulesResult({argv, cwd, rules: include_rules, variables: opts.variables}, gitData);
                if (rulesResult.when === "never") {
                    continue;
                }
            }
            if (value["local"]) {
                validateIncludeLocal(value["local"]);
                const files = await resolveIncludeLocal(value["local"], cwd);
                if (files.length == 0) {
                    throw new AssertionError({message: `Local include file cannot be found ${value["local"]}`});
                }
                for (const localFile of files) {
                    const content = await Parser.loadYaml(localFile, {inputs: value.inputs ?? {}}, expandVariables);
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
                        if (inner["rules"]) {
                            const rulesResult = Utils.getRulesResult({argv, cwd: opts.cwd, variables: opts.variables, rules: inner["rules"]}, gitData);
                            if (rulesResult.when === "never") {
                                return;
                            }
                        }
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
                const {domain, port, projectPath, componentName, ref, isLocalComponent} = this.parseIncludeComponent(value["component"], gitData);
                // converts component to project. gitlab allows two different file path ways to include a component
                let files = [`${componentName}.yml`, `${componentName}/template.yml`, null];

                // If a file is present locally, keep only that one in the files array to avoid downloading the other one that never exists
                if (!argv.fetchIncludes) {
                    for (const f of files) {
                        const localFileName = `${cwd}/${stateDir}/includes/${gitData.remote.host}/${projectPath}/${ref}/${f}`;
                        if (fs.existsSync(localFileName)) {
                            files = [f];
                            break;
                        }
                    }
                }

                for (const f of files) {
                    assert(f !== null, `This GitLab CI configuration is invalid: component: \`${value["component"]}\`. One of the files [${files}] must exist in \`${domain}` +
                                        (port ? `:${port}` : "") + `/${projectPath}\``);

                    if (isLocalComponent) {
                        const localComponentInclude = `${cwd}/${f}`;
                        if (!(await fs.pathExists(localComponentInclude))) {
                            continue;
                        }

                        const content = await Parser.loadYaml(localComponentInclude, {inputs: value.inputs || {}}, expandVariables);
                        includeDatas = includeDatas.concat(await this.init(content, opts));
                        break;
                    } else {
                        const localFileName = `${cwd}/${stateDir}/includes/${gitData.remote.host}/${projectPath}/${ref}/${f}`;
                        // Check remotely only if the file does not exist locally
                        if (!fs.existsSync(localFileName) && !(await Utils.remoteFileExist(cwd, f, ref, domain, projectPath, gitData.remote.schema, gitData.remote.port))) {
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
                        break;
                    }
                }
            } else if (value["template"]) {
                const {project, ref, file, domain} = this.covertTemplateToProjectFile(value["template"]);
                const fsUrl = Utils.fsUrl(`https://${domain}/${project}/-/raw/${ref}/${file}`);
                const fileDoc = await Parser.loadYaml(
                    `${cwd}/${stateDir}/includes/${fsUrl}`, {inputs: value.inputs || {}}, expandVariables,
                );
                includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
            } else if (value["remote"]) {
                const fsUrl = Utils.fsUrl(value["remote"]);
                const fileDoc = await Parser.loadYaml(
                    `${cwd}/${stateDir}/includes/${fsUrl}`, {inputs: value.inputs || {}}, expandVariables,
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
                if (Array.isArray(value)) {
                    entry[key] = value.map((v) => Utils.expandText(v, variables));
                } else {
                    entry[key] = Utils.expandText(value, variables);
                }
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

    static parseIncludeComponent (component: string, gitData: GitData): {domain: string; port: string; projectPath: string; componentName: string; ref: string; isLocalComponent: boolean} {
        assert(!component.includes("://"), `This GitLab CI configuration is invalid: component: \`${component}\` should not contain protocol`);
        const pattern = /(?<domain>[^/:\s]+)(:(?<port>\d+))?\/(?<projectPath>.+)\/(?<componentName>[^@]+)@(?<ref>.+)/; // https://regexr.com/7v7hm
        const gitRemoteMatch = pattern.exec(component);

        if (gitRemoteMatch?.groups == null) throw new Error(`This is a bug, please create a github issue if this is something you're expecting to work. input: ${component}`);

        const {domain, projectPath, port} = gitRemoteMatch.groups;
        let ref = gitRemoteMatch.groups["ref"];
        const isLocalComponent = projectPath === `${gitData.remote.group}/${gitData.remote.project}` && ref === gitData.commit.SHA;

        if (!isLocalComponent) {
            const semanticVersionRangesPattern = /^\d+(\.\d+)?$/;
            if (ref == "~latest" || semanticVersionRangesPattern.test(ref)) {
                // https://docs.gitlab.com/ci/components/#semantic-version-ranges
                let stdout;
                try {
                    stdout = Utils.syncSpawn(["git", "ls-remote", "--tags", `git@${domain}:${projectPath}`]).stdout;
                } catch {
                    stdout = Utils.syncSpawn(["git", "ls-remote", "--tags", `https://${domain}:${port ?? 443}/${projectPath}.git`]).stdout;
                }
                assert(stdout);
                const tags = stdout
                    .split("\n")
                    .map((line) => {
                        return line
                            .split("\t")[1]
                            .split("/")[2];
                    });
                const _ref = resolveSemanticVersionRange(ref, tags);
                assert(_ref, `This GitLab CI configuration is invalid: component: \`${component}\` - The ref (${ref}) is invalid`);
                ref = _ref;
            }
        }
        return {
            domain: domain,
            port: port,
            projectPath: projectPath,
            componentName: `templates/${gitRemoteMatch.groups["componentName"]}`,
            ref: ref,
            isLocalComponent: isLocalComponent,
        };
    }

    static async downloadIncludeRemote (cwd: string, stateDir: string, url: string, fetchIncludes: boolean): Promise<void> {
        const fsUrl = Utils.fsUrl(url);
        try {
            const target = `${cwd}/${stateDir}/includes/${fsUrl}`;
            if (await fs.pathExists(target) && !fetchIncludes) return;
            const axiosConfig: AxiosRequestConfig = {
                headers: {"User-Agent": "gitlab-ci-local"},
                ...Utils.getAxiosProxyConfig(),
            };
            const res = await axios.get(url, axiosConfig);
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

                const gitCloneBranch = (ref === "HEAD") ? "" : `--branch ${ref}`;
                await Utils.bashMulti([
                    `cd ${cwd}/${stateDir}`,
                    `git clone ${gitCloneBranch} -n --depth=1 --filter=tree:0 ${remote.schema}://${remote.host}:${remote.port}/${project}.git ${cwd}/${target}.${ext}`,
                    `cd ${cwd}/${target}.${ext}`,
                    `git sparse-checkout set --no-cone ${normalizedFile}`,
                    "git checkout",
                    `cd ${cwd}/${stateDir}`,
                    `cp ${cwd}/${target}.${ext}/${normalizedFile} ${cwd}/${target}/${normalizedFile}`,
                ], cwd);
            } else {
                await fs.mkdirp(`${cwd}/${target}`);
                await Utils.bash(`set -eou pipefail; git archive --remote=ssh://git@${remote.host}:${remote.port}/${project}.git ${ref} ${normalizedFile} | tar -f - -xC ${target}/`, cwd);
            }
        } catch (e) {
            throw new AssertionError({message: `Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${normalizedFile} }\n${e}`});
        }
    }

    static readonly memoLocalRepoFiles = (() => {
        const cache = new Map<string, string[]>();
        return async (path: string) => {
            let result = cache.get(path);
            if (typeof result !== "undefined") return result;

            result = (await Utils.getTrackedFiles(path)).map(p => `${path}/${p}`);
            cache.set(path, result);
            return result;
        };
    })();
}

export function validateIncludeLocal (filePath: string) {
    assert(!filePath.startsWith("./"), `\`${filePath}\` for include:local is invalid. Gitlab does not support relative path (ie. cannot start with \`./\`).`);
    assert(!filePath.includes(".."), `\`${filePath}\` for include:local is invalid. Gitlab does not support directory traversal.`);
}

export function resolveSemanticVersionRange (range: string, gitTags: string[]) {
    /** sorted list of tags thats compliant to semantic version where index 0 is the latest */
    const sanitizedSemverTags = semver.rsort(
        gitTags.filter(s => semver.valid(s)),
    );

    const found = sanitizedSemverTags.find(t => {
        if (range == "~latest") {
            const semverParsed = semver.parse(t);
            assert(semverParsed);
            return (semverParsed.prerelease.length == 0 && semverParsed.build.length == 0);
        } else {
            return semver.satisfies(t, range);
        }
    });
    return found;
}

export async function resolveIncludeLocal (pattern: string, cwd: string) {
    const repoFiles = await ParserIncludes.memoLocalRepoFiles(cwd);

    if (!pattern.startsWith("/")) pattern = `/${pattern}`; // Ensure pattern starts with `/`
    pattern = `${cwd}${pattern}`;

    // escape all special regex metacharacters
    pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // `**` matches anything
    const anything = ".*?";
    pattern = pattern.replace(/\\\*\\\*/g, anything);

    // `*` matches anything except for `/`
    const anything_but_not_slash = "([^/])*?";
    pattern = pattern.replace(/\\\*/g, anything_but_not_slash);

    const re2js = RE2JS.compile(`^${pattern}`);
    return repoFiles.filter((f: any) => re2js.matches(f));
}
