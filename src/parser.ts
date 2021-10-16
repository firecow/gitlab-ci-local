import chalk from "chalk";
import deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import prettyHrtime from "pretty-hrtime";
import {Job} from "./job";
import * as jobExpanders from "./job-expanders";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";
import {assert} from "./asserts";
import * as path from "path";
import {WriteStreams} from "./types/write-streams";
import {ParserOptions} from "./types/parser-options";
import {Validator} from "./validator";
import {GitData} from "./types/git-data";
import {ParserIncludes} from "./parser-includes";
import {Producers} from "./producers";

export class Parser {

    private readonly opt: ParserOptions;

    private _jobs: Map<string, Job> = new Map();
    private _stages: string[] = [];
    private _gitData: GitData | null = null;
    private _homeVariables: { [key: string]: string } | null = null;
    private _gitlabData: any;
    private _jobNamePad = 0;

    private constructor(opt: ParserOptions) {
        this.opt = opt;
    }

    get jobs(): ReadonlyMap<string, Job> {
        return this._jobs;
    }

    get stages(): readonly string[] {
        return this._stages;
    }

    get gitlabData() {
        return this._gitlabData;
    }

    get jobNamePad(): number {
        return this._jobNamePad;
    }

    static async create(opt: ParserOptions) {
        const writeStreams = opt.writeStreams;
        const parser = new Parser(opt);

        const time = process.hrtime();
        await parser.init();
        await Validator.run(parser.jobs, parser.stages);
        const parsingTime = process.hrtime(time);

        if (opt.showInitMessage ?? true) {
            writeStreams.stdout(chalk`{grey parsing and downloads finished} in {grey ${prettyHrtime(parsingTime)}}\n`);
        }

        return parser;
    }

    static async initGitData(cwd: string): Promise<GitData> {
        let gitlabUserEmail, gitlabUserName;

        try {
            const {stdout: gitConfigEmail} = await Utils.spawn("git config user.email", cwd);
            gitlabUserEmail = gitConfigEmail.trimEnd();
        } catch (e) {
            gitlabUserEmail = "local@gitlab.com";
        }
        const gitlabUserLogin = gitlabUserEmail.replace(/@.*/, "");
        try {
            const {stdout: gitConfigUserName} = await Utils.spawn("git config user.name", cwd);
            gitlabUserName = gitConfigUserName.trimEnd();
        } catch (e) {
            gitlabUserName = "Bob Local";
        }

        let gitConfig;
        if (fs.existsSync(`${cwd}/.git/config`)) {
            gitConfig = fs.readFileSync(`${cwd}/.git/config`, "utf8");
        } else if (fs.existsSync(`${cwd}/.gitconfig`)) {
            gitConfig = fs.readFileSync(`${cwd}/.gitconfig`, "utf8");
        } else {
            throw new ExitError("Could not locate.gitconfig or .git/config file");
        }
        const gitRemoteMatch = gitConfig.match(/url = .*(?:http[s]?:\/\/|@)(?<domain>.*?)[:|/](?<group>.*)\/(?<project>.*?)(?:\r?\n|\.git)/);
        assert(gitRemoteMatch?.groups != null, "git config didn't provide valid matches");
        assert(gitRemoteMatch.groups.domain != null, "<domain> not found in git config");
        assert(gitRemoteMatch.groups.group != null, "<group> not found in git config");
        assert(gitRemoteMatch.groups.project != null, "<project> not found in git config");

        const {stdout: gitLogStdout} = await Utils.spawn("git log -1 --pretty=format:'%h %H %D'", cwd);
        const gitLogOutput = gitLogStdout.replace(/\r?\n/g, "");
        let gitLogMatch;
        if (gitLogOutput.match(/HEAD, tag/)) {
            gitLogMatch = gitLogOutput.match(/(?<short_sha>.*?) (?<sha>.*?) HEAD, tag: (?<ref_name>.*?),/);
        } else {
            gitLogMatch = gitLogOutput.match(/(?<short_sha>.*?) (?<sha>.*?) HEAD -> (?<ref_name>.*?)(?:,|$)/);
        }
        assert(gitLogMatch?.groups != null, "git log -1 didn't provide valid matches");
        assert(gitLogMatch.groups.ref_name != null, "<ref_name> not found in git log -1");
        assert(gitLogMatch.groups.sha != null, "<sha> not found in git log -1");
        assert(gitLogMatch.groups.short_sha != null, "<short_sha> not found in git log -1");

        return new GitData({
            user: {
                GITLAB_USER_LOGIN: gitlabUserLogin,
                GITLAB_USER_EMAIL: gitlabUserEmail,
                GITLAB_USER_NAME: gitlabUserName,
            },
            remote: {
                domain: gitRemoteMatch.groups.domain,
                group: gitRemoteMatch.groups.group,
                project: gitRemoteMatch.groups.project,
            },
            commit: {
                REF_NAME: gitLogMatch.groups.ref_name,
                SHA: gitLogMatch.groups.sha,
                SHORT_SHA: gitLogMatch.groups.short_sha,
            },
        });
    }

    static async initHomeVariables(cwd: string, writeStreams: WriteStreams, gitData: GitData, home: string): Promise<{ [key: string]: string }> {
        const homeDir = home.replace(/\/$/, "");
        const variablesFile = `${homeDir}/.gitlab-ci-local/variables.yml`;
        if (!fs.existsSync(variablesFile)) {
            return {};
        }

        const data: any = yaml.load(await fs.readFile(variablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA});
        let variables: { [key: string]: string } = {};

        for (const [globalKey, globalEntry] of Object.entries(data?.global ?? [])) {
            if (typeof globalEntry !== "string") {
                continue;
            }
            variables[globalKey] = globalEntry;
        }

        const groupUrl = `${gitData.remote.domain}/${gitData.remote.group}/`;
        for (const [groupKey, groupEntries] of Object.entries(data?.group ?? [])) {
            if (!groupUrl.includes(Parser.normalizeProjectKey(groupKey, writeStreams))) {
                continue;
            }
            if (typeof groupEntries !== "object") {
                continue;
            }
            variables = {...variables, ...groupEntries};
        }

        const projectUrl = `${gitData.remote.domain}/${gitData.remote.group}/${gitData.remote.project}.git`;
        for (const [projectKey, projectEntries] of Object.entries(data?.project ?? [])) {
            if (!projectUrl.includes(Parser.normalizeProjectKey(projectKey, writeStreams))) {
                continue;
            }
            if (typeof projectEntries !== "object") {
                continue;
            }
            variables = {...variables, ...projectEntries};
        }

        const projectVariablesFile = `${cwd}/.gitlab-ci-local/variables.yml`;

        if (fs.existsSync(projectVariablesFile)) {
            const projectEntries: any = yaml.load(await fs.readFile(projectVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA}) ?? {};
            if (typeof projectEntries === "object") {
                variables = {...variables, ...projectEntries};
            }
        }

        // Generate files for file type variables
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value !== "string") {
                continue;
            }
            if (!value.match(/^[/|~]/)) {
                continue;
            }

            if (value.match(/\/$/)) {
                continue;
            }

            const fromFilePath = value.replace(/^~\/(.*)/, `${homeDir}/$1`);
            if (fs.existsSync(fromFilePath)) {
                await fs.mkdirp(`/tmp/gitlab-ci-local-file-variables-${gitData.CI_PROJECT_PATH_SLUG}/`);
                await fs.copyFile(fromFilePath, `/tmp/gitlab-ci-local-file-variables-${gitData.CI_PROJECT_PATH_SLUG}/${path.basename(fromFilePath)}`);
                variables[key] = `/tmp/gitlab-ci-local-file-variables-${gitData.CI_PROJECT_PATH_SLUG}/${path.basename(fromFilePath)}`;
            }
        }

        return variables;
    }

    static normalizeProjectKey(key: string, writeStreams: WriteStreams): string {
        if (!key.includes(":")) return key;
        writeStreams.stderr(chalk`{yellow WARNING: Interpreting '${key}' as '${key.replace(":", "/")}'}\n`);
        return key.replace(":", "/");
    }

    async init() {
        const cwd = this.opt.cwd;
        const writeStreams = this.opt.writeStreams;
        const home = this.opt.home;
        const file = this.opt.file;
        const fetchIncludes = this.opt.fetchIncludes ?? true;
        const pipelineIid = this.opt.pipelineIid;
        const extraHosts = this.opt.extraHosts || [];
        const volumes = this.opt.volumes || [];

        this._gitData = await Parser.initGitData(cwd);
        this._homeVariables = await Parser.initHomeVariables(cwd, writeStreams, this._gitData, home ?? process.env.HOME ?? "");

        let ymlPath, yamlDataList: any[] = [{stages: [".pre", "build", "test", "deploy", ".post"]}];
        ymlPath = file ? `${cwd}/${file}` : `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await ParserIncludes.init(gitlabCiData, cwd, writeStreams, this._gitData, fetchIncludes, 0));

        ymlPath = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await ParserIncludes.init(gitlabCiLocalData, cwd, writeStreams, this._gitData, fetchIncludes, 0));

        const gitlabData: any = deepExtend({}, ...yamlDataList);

        // Expand various fields in gitlabData
        jobExpanders.reference(gitlabData, gitlabData);
        jobExpanders.jobExtends(gitlabData);
        jobExpanders.artifacts(gitlabData);
        jobExpanders.image(gitlabData);
        jobExpanders.services(gitlabData);
        jobExpanders.beforeScripts(gitlabData);
        jobExpanders.afterScripts(gitlabData);
        jobExpanders.scripts(gitlabData);


        assert(gitlabData.stages && Array.isArray(gitlabData.stages), chalk`{yellow stages:} must be an array`);
        if (!gitlabData.stages.includes(".pre")) {
            gitlabData.stages.unshift(".pre");
        }
        if (!gitlabData.stages.includes(".post")) {
            gitlabData.stages.push(".post");
        }
        this._stages = gitlabData.stages;

        // Find longest job name
        Utils.forEachRealJob(gitlabData, (jobName) => {
            this._jobNamePad = Math.max(this.jobNamePad, jobName.length);
        });

        // Check job variables for invalid hash of key value pairs
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            for (const [key, value] of Object.entries(jobData.variables || {})) {
                assert(
                    typeof value === "string" || typeof value === "number",
                    chalk`{blueBright ${jobName}} has invalid variables hash of key value pairs. ${key}=${value}`
                );
            }
        });

        this._gitlabData = gitlabData;

        // Generate jobs and put them into stages
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            assert(this._gitData != null, "gitData must be set");
            assert(this._homeVariables != null, "homeVariables must be set");

            const job = new Job({
                volumes,
                extraHosts,
                writeStreams,
                name: jobName,
                namePad: this.jobNamePad,
                homeVariables: this._homeVariables,
                shellIsolation: this.opt.shellIsolation ?? false,
                data: jobData,
                cwd,
                globals: gitlabData,
                pipelineIid,
                gitData: this._gitData,
            });
            const foundStage = this.stages.includes(job.stage);
            assert(foundStage, chalk`{yellow stage:${job.stage}} not found for {blueBright ${job.name}}`);
            this._jobs.set(jobName, job);
        });

        // Generate producers for each job
        this.jobs.forEach((job) => {
            job.producers = Producers.init(this.jobs, this.stages, job);
        });
    }

    static async loadYaml(filePath: string): Promise<any> {
        const ymlPath = `${filePath}`;
        if (!fs.existsSync(ymlPath)) {
            return {};
        }

        const fileContent = await fs.readFile(`${filePath}`, "utf8");
        const fileSplit = fileContent.split(/\r?\n/g);
        const fileSplitClone = fileSplit.slice();

        let interactiveMatch = null;
        let descriptionMatch = null;
        let injectSSHAgent = null;
        let index = 0;
        for (const line of fileSplit) {
            interactiveMatch = !interactiveMatch ? line.match(/#[\s]?@[\s]?[Ii]nteractive/) : interactiveMatch;
            injectSSHAgent = !injectSSHAgent ? line.match(/#[\s]?@[\s]?[Ii]njectSSHAgent/) : injectSSHAgent;
            descriptionMatch = !descriptionMatch ? line.match(/#[\s]?@[\s]?[Dd]escription (?<description>.*)/) : descriptionMatch;
            const jobMatch = line.match(/\w:/);
            if (jobMatch && (interactiveMatch || descriptionMatch || injectSSHAgent)) {
                if (interactiveMatch) {
                    fileSplitClone.splice(index + 1, 0, "  interactive: true");
                    index++;
                }
                if (injectSSHAgent) {
                    fileSplitClone.splice(index + 1, 0, "  injectSSHAgent: true");
                    index++;
                }
                if (descriptionMatch) {
                    fileSplitClone.splice(index + 1, 0, `  description: ${descriptionMatch?.groups?.description ?? ""}`);
                    index++;
                }
                interactiveMatch = null;
                descriptionMatch = null;
                injectSSHAgent = null;
            }
            index++;
        }

        const referenceType = new yaml.Type("!reference", {
            kind: "sequence",
            construct: function (data) {
                return {referenceData: data};
            },
        });
        const schema = yaml.DEFAULT_SCHEMA.extend([referenceType]);
        return yaml.load(fileSplitClone.join("\n"), {schema}) || {};
    }

}
