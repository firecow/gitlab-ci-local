import {Argv} from "./argv.js";
import {Utils} from "./utils.js";
import fs from "fs-extra";
import {WriteStreams} from "./write-streams.js";
import {GitData} from "./git-data.js";
import assert, {AssertionError} from "assert";
import chalk from "chalk-template";
import {Parser} from "./parser.js";
import axios from "axios";
import path from "path";
import semver from "semver";
import {RE2JS} from "re2js";

// Use fetch adapter instead of bun's xhr adapter which returns incorrect responses for some URLs
axios.defaults.adapter = "fetch";

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

type ParsedComponent = {
    domain: string;
    port: string;
    projectPath: string;
    name: string;
    ref: string;
    isLocal: boolean;
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
        // cache the parsed component, because parseIncludeComponent is expensive and we would call it twice otherwise
        const componentParseCache = new Map<number, ParsedComponent>();

        const include = this.expandInclude(gitlabData?.include, opts.variables);

        this.normalizeTriggerInclude(gitlabData, opts);
        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const [index, value] of include.entries()) {
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
            } else if (value["component"]) {
                const component = this.parseIncludeComponent(value["component"], gitData);
                componentParseCache.set(index, component);
                if (!component.isLocal)
                {
                    promises.push(this.downloadIncludeComponent(cwd, stateDir, component.projectPath, component.ref, component.name, gitData, fetchIncludes));
                }
            }

        }

        await Promise.all(promises);

        for (const [index, value] of include.entries()) {
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
                    fileDoc["include"] = this.expandInnerLocalIncludes(fileDoc["include"], value["project"], value["ref"], opts);
                    includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
                }
            } else if (value["component"]) {
                const component = componentParseCache.get(index);
                assert(component !== undefined, `Internal error, component parse cache missing entry [${index}]`);
                // Gitlab allows two different file paths to include a component
                const files = [`${component.name}.yml`, `${component.name}/template.yml`];

                let file = null;
                for (const f of files) {
                    let searchPath = `${cwd}/${f}`;
                    if (!component.isLocal) {
                        searchPath = `${cwd}/${stateDir}/includes/${gitData.remote.host}/${component.projectPath}/${component.ref}/${f}`;
                    }
                    if (fs.existsSync(searchPath)) {
                        file = searchPath;
                    }
                }
                assert(file !== null, `This GitLab CI configuration is invalid: component: \`${value["component"]}\`. One of the files [${files}] must exist in \`${component.domain}` +
                                    (component.port ? `:${component.port}` : "") + `/${component.projectPath}\``);

                const fileDoc = await Parser.loadYaml(file, {inputs: value.inputs || {}}, expandVariables);
                // Expand local includes inside to a "project"-like include
                fileDoc["include"] = this.expandInnerLocalIncludes(fileDoc["include"], component.projectPath, component.ref, opts);
                includeDatas = includeDatas.concat(await this.init(fileDoc, opts));
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

    static parseIncludeComponent (component: string, gitData: GitData): ParsedComponent {
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
                if (gitData.remote.schema == "git" || gitData.remote.schema == "ssh") {
                    stdout = Utils.syncSpawn(["git", "ls-remote", "--tags", `git@${domain}:${projectPath}`]).stdout;
                } else {
                    stdout = Utils.syncSpawn(["git", "ls-remote", "--tags", `${gitData.remote.schema}://${domain}:${port ?? 443}/${projectPath}.git`]).stdout;
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
            name: `templates/${gitRemoteMatch.groups["componentName"]}`,
            ref: ref,
            isLocal: isLocalComponent,
        };
    }

    // Expand local includes inside to a "project"-like include
    static expandInnerLocalIncludes (fileIncludes: any, projectPath: string, ref: string, opts: ParserIncludesInitOptions) {
        const {argv} = opts;
        const updatedIncludes = this.expandInclude(fileIncludes, opts.variables);
        updatedIncludes.forEach((inner: any, i: number) => {
            if (!inner["local"]) return;
            if (inner["rules"]) {
                const rulesResult = Utils.getRulesResult({argv, cwd: opts.cwd, variables: opts.variables, rules: inner["rules"]}, opts.gitData);
                if (rulesResult.when === "never") {
                    return;
                }
            }
            updatedIncludes[i] = {
                project: projectPath,
                file: inner["local"].replace(/^\//, ""),
                ref: ref,
                inputs: inner.inputs || {},
            };
        });
        return updatedIncludes;
    }

    static async downloadIncludeRemote (cwd: string, stateDir: string, url: string, fetchIncludes: boolean): Promise<void> {
        const fsUrl = Utils.fsUrl(url);
        try {
            const target = `${cwd}/${stateDir}/includes/${fsUrl}`;
            if (await fs.pathExists(target) && !fetchIncludes) return;
            const res = await axios.get(url, {
                headers: {"User-Agent": "gitlab-ci-local"},
                ...Utils.getAxiosProxyConfig(),
            });
            await fs.outputFile(target, res.data);
        } catch (e) {
            throw new AssertionError({message: `Remote include could not be fetched ${url}\n${e}`});
        }
    }

    static async downloadIncludeProjectFile (cwd: string, stateDir: string, project: string, ref: string, file: string, gitData: GitData, fetchIncludes: boolean): Promise<void> {
        const remote = gitData.remote;
        const normalizedFile = file.replace(/^\/+/, "");
        let tmpDir = null;
        try {
            const target = `${stateDir}/includes/${remote.host}/${project}/${ref}`;
            if (await fs.pathExists(`${cwd}/${target}/${normalizedFile}`) && !fetchIncludes) return;

            if (remote.schema.startsWith("http")) {
                const ext = "tmp-" + Math.random();
                await fs.mkdirp(path.dirname(`${cwd}/${target}/${normalizedFile}`));
                tmpDir = `${cwd}/${target}.${ext}`;

                const gitCloneBranch = (ref === "HEAD") ? "" : `--branch ${ref}`;
                await Utils.bashMulti([
                    `cd ${cwd}/${stateDir}`,
                    `git clone ${gitCloneBranch} -n --depth=1 --filter=tree:0 ${remote.schema}://${remote.host}:${remote.port}/${project}.git ${tmpDir}`,
                    `cd ${tmpDir}`,
                    `git sparse-checkout set --no-cone ${normalizedFile}`,
                    "git checkout",
                    `cd ${cwd}/${stateDir}`,
                    `cp ${tmpDir}/${normalizedFile} ${cwd}/${target}/${normalizedFile}`,
                ], cwd);
            } else {
                await fs.mkdirp(`${cwd}/${target}`);
                await Utils.bash(`set -eou pipefail; git archive --remote=ssh://git@${remote.host}:${remote.port}/${project}.git ${ref} ${normalizedFile} | tar -f - -xC ${target}/`, cwd);
            }
        } catch (e) {
            throw new AssertionError({message: `Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${normalizedFile} }\n${e}`});
        } finally {
            if (tmpDir !== null) {
                // always cleanup temporary directory (if created)
                await fs.rm(tmpDir, {recursive: true, force: true});
            }
        }
    }

    static async downloadIncludeComponent (cwd: string, stateDir: string, project: string, ref: string, componentName: string, gitData: GitData, fetchIncludes: boolean): Promise<void> {
        const remote = gitData.remote;
        const files = [`${componentName}.yml`, `${componentName}/template.yml`];
        let tmpDir = null;
        try {
            const target = `${stateDir}/includes/${remote.host}/${project}/${ref}`;

            if (!fetchIncludes && (await fs.pathExists(`${cwd}/${target}/${files[0]}`) || await fs.pathExists(`${cwd}/${target}/${files[1]}`))) return;

            if (remote.schema.startsWith("http")) {
                const ext = "tmp-" + Math.random();
                await fs.mkdirp(path.dirname(`${cwd}/${target}/templates`));
                tmpDir = `${cwd}/${target}.${ext}`;

                const gitCloneBranch = (ref === "HEAD") ? "" : `--branch ${ref}`;
                await Utils.bashMulti([
                    `cd ${cwd}/${stateDir}`,
                    `git clone ${gitCloneBranch} -n --depth=1 --filter=tree:0 ${remote.schema}://${remote.host}:${remote.port}/${project}.git ${tmpDir}`,
                    `cd ${tmpDir}`,
                    `git sparse-checkout set --no-cone ${files[0]} ${files[1]}`,
                    "git checkout",
                    `cd ${cwd}/${stateDir}`,
                    `mkdir -p ${tmpDir}/templates`, // create templates subdir (if it doesn't exist), as the check out may not create it
                    `cp -r ${tmpDir}/templates ${cwd}/${target}`,
                ], cwd);
            } else {
                // git archive fails if the paths do not exist, to work around this we use a wildcard "templates/component*.yml"
                // this resolves to either "templates/component.yml" or "templates/component/template.yml"
                // if both exist "templates/component.yml" will be pulled
                // Drawback: also pulls all other .yml files from templates/component/ directory
                const componentWildcard = `${componentName}*.yml`;
                await fs.mkdirp(`${cwd}/${target}`);
                await Utils.bash(`set -eou pipefail; git archive --remote=ssh://git@${remote.host}:${remote.port}/${project}.git ${ref} ${componentWildcard} | tar -f - -xC ${target}/`, cwd);
            }
        } catch (e) {
            throw new AssertionError({message: `Component include could not be fetched { project: ${project}, ref: ${ref}, file: ${files} }\n${e}`});
        } finally {
            if (tmpDir !== null) {
                // always cleanup temporary directory (if created)
                await fs.rm(tmpDir, {recursive: true, force: true});
            }
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
