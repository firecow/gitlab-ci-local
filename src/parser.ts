import * as chalk from "chalk";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as prettyHrtime from "pretty-hrtime";
import fetch from "node-fetch";
import {Job} from "./job";
import * as jobExpanders from "./job-expanders";
import {Stage} from "./stage";
import * as state from "./state";
import {ExitError} from "./types/exit-error";
import {GitRemote} from "./types/git-remote";
import {GitUser} from "./types/git-user";
import {Utils} from "./utils";
import {assert} from "./asserts";
import * as path from "path";
import {WriteStreams} from "./types/write-streams";
import {ParserOptions} from "./types/parser-options";

export class Parser {

    private readonly jobs: Map<string, Job> = new Map();
    private readonly stages: Map<string, Stage> = new Map();
    private readonly opt: ParserOptions;

    private gitRemote: GitRemote | null = null;
    private homeVariables: any;
    private _gitlabData: any;
    private _jobNamePad = 0;

    private constructor(opt: ParserOptions) {
        this.opt = opt;
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
        await parser.initJobs();
        await parser.validateNeedsTags();
        const parsingTime = process.hrtime(time);

        if (!opt.tabCompletionPhase) {
            writeStreams.stdout(chalk`{cyan ${"yml files".padEnd(parser.jobNamePad)}} {magentaBright processed} in {magenta ${prettyHrtime(parsingTime)}}\n`);
        }

        return parser;
    }

    static async initGitUser(cwd: string): Promise<GitUser> {
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

        return {
            GITLAB_USER_LOGIN: gitlabUserLogin,
            GITLAB_USER_EMAIL: gitlabUserEmail,
            GITLAB_USER_NAME: gitlabUserName,
        };
    }

    static async initHomeVariables(cwd: string, gitRemote: GitRemote, home: string): Promise<{ [key: string]: string }> {
        const homeDir = home.replace(/\/$/, "");
        const variablesFile = `${homeDir}/.gitlab-ci-local/variables.yml`;
        if (!fs.existsSync(variablesFile)) {
            return {};
        }

        const data: any = yaml.load(await fs.readFile(variablesFile, "utf8"));
        let variables: { [key: string]: string } = {};

        for (const [globalKey, globalEntry] of Object.entries(data?.global ?? [])) {
            if (typeof globalEntry !== "string") {
                continue;
            }
            variables[globalKey] = globalEntry;
        }

        for (const [groupKey, groupEntires] of Object.entries(data?.group ?? [])) {
            if (!`${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}.git`.includes(groupKey)) {
                continue;
            }
            if (typeof groupEntires !== "object") {
                continue;
            }
            variables = {...variables, ...groupEntires};
        }

        for (const [projectKey, projectEntries] of Object.entries(data?.project ?? [])) {
            if (!`${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}.git`.includes(projectKey)) {
                continue;
            }
            if (typeof projectEntries !== "object") {
                continue;
            }
            variables = {...variables, ...projectEntries};
        }

        const projectVariablesFile = `${cwd}/.gitlab-ci-local/variables.yml`;

        if (fs.existsSync(projectVariablesFile)) {
            const projectEntries: any = yaml.load(await fs.readFile(projectVariablesFile, "utf8")) ?? {};
            if (typeof projectEntries === "object") {
                variables = {...variables, ...projectEntries};
            }
        }

        // Generate files for file type variables
        for (const [key, value] of Object.entries(variables)) {
            if (!value.match(/^[/|~]/)) {
                continue;
            }

            if (value.match(/\/$/)) {
                continue;
            }

            const fromFilePath = value.replace(/^~\/(.*)/, `${homeDir}/$1`);
            if (fs.existsSync(fromFilePath)) {
                await fs.ensureDir(`${cwd}/.gitlab-ci-local/file-variables/`);
                await fs.copyFile(fromFilePath, `${cwd}/.gitlab-ci-local/file-variables/${path.basename(fromFilePath)}`);
                variables[key] = `.gitlab-ci-local/file-variables/${path.basename(fromFilePath)}`;
            }
        }

        return variables;
    }

    async init() {
        const cwd = this.opt.cwd;
        const writeStreams = this.opt.writeStreams;
        const home = this.opt.home;
        const file = this.opt.file;
        const tabCompletionPhase = this.opt.tabCompletionPhase;

        this.gitRemote = await Parser.initGitRemote(cwd);
        this.homeVariables = await Parser.initHomeVariables(cwd, this.gitRemote, home ?? process.env.HOME ?? "");

        let ymlPath, yamlDataList: any[] = [];
        ymlPath = file ? `${cwd}/${file}` : `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await Parser.prepareIncludes(gitlabCiData, cwd, writeStreams, this.gitRemote, tabCompletionPhase));

        ymlPath = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await Parser.prepareIncludes(gitlabCiLocalData, cwd, writeStreams, this.gitRemote, tabCompletionPhase));

        const gitlabData: any = deepExtend({}, ...yamlDataList);

        // Make sure artifact paths doesn't contain globstar
        // TODO: This deviates from gitlab ci behavior
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            jobData?.artifacts?.paths?.forEach((artifactPath: any) => {
                assert(!artifactPath.includes("*"), `Artfact paths cannot contain globstar, yet! '${jobName}'`);
            });
        });

        // Expand various fields in gitlabData
        jobExpanders.reference(gitlabData, gitlabData);
        jobExpanders.jobExtends(gitlabData);
        jobExpanders.artifacts(gitlabData);
        jobExpanders.image(gitlabData);
        jobExpanders.beforeScripts(gitlabData);
        jobExpanders.afterScripts(gitlabData);
        jobExpanders.scripts(gitlabData);

        // If undefined set default array.
        if (!gitlabData.stages) {
            gitlabData.stages = ["build", "test", "deploy"];
        }

        // 'stages:' must be an array
        assert(gitlabData.stages && Array.isArray(gitlabData.stages), chalk`{yellow stages:} must be an array`);

        // Make sure stages includes ".pre" and ".post". See: https://docs.gitlab.com/ee/ci/yaml/#pre-and-post
        if (!gitlabData.stages.includes(".pre")) {
            gitlabData.stages.unshift(".pre");
        }
        if (!gitlabData.stages.includes(".post")) {
            gitlabData.stages.push(".post");
        }

        // Create stages and set into Map
        for (const value of gitlabData.stages || []) {
            this.stages.set(value, new Stage(value));
        }

        // Find longest job name
        for (const jobName of Object.keys(gitlabData)) {
            if (Job.illegalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }
            this._jobNamePad = Math.max(this.jobNamePad, jobName.length);
        }

        // Check that needs is larger and containers the same as dependencies.
        // TODO: We need this check, to prevent jobs from copying artifacts that might not be needed.

        // Check job variables for invalid hash of key value pairs
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            for (const [key, value] of Object.entries(jobData.variables || {})) {
                const valueStr = `${value}`;
                assert(
                    typeof value === "string" || typeof value === "number",
                    chalk`{blueBright ${jobName}} has invalid variables hash of key value pairs. ${key}=${valueStr}`
                );
            }
        });
        // chalk`{blueBright ${jobName}} has invalid variables hash of key value pairs. ${key}=${value}`}`
        this._gitlabData = gitlabData;
    }

    async initJobs() {
        assert(this.gitRemote != null, "GitRemote isn't set in parser initJobs function");

        const writeStreams = this.opt.writeStreams;
        const pipelineIid = this.opt.pipelineIid;
        const cwd = this.opt.cwd;
        const extraHosts = this.opt.extraHosts || [];
        const gitlabData = this._gitlabData;

        const gitUser = await Parser.initGitUser(cwd);

        // Generate jobs and put them into stages
        for (const [jobName, jobData] of Object.entries(gitlabData)) {
            if (Job.illegalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }

            const jobId = await state.getJobId(cwd);
            const job = new Job({
                extraHosts,
                writeStreams,
                name: jobName,
                namePad: this.jobNamePad,
                homeVariables: this.homeVariables,
                data: jobData,
                cwd,
                globals: gitlabData,
                pipelineIid,
                id: jobId,
                gitUser,
                gitRemote: this.gitRemote,
            });
            const stage = this.stages.get(job.stage);
            const stageStr = `stage:${job.stage}`;
            assert(stage != null, chalk`{yellow ${stageStr}} not found for {blueBright ${job.name}}`);
            stage.addJob(job);
            await state.incrementJobId(cwd);

            this.jobs.set(jobName, job);
        }

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
            const jobMatch = line.match(/(?<jobname>\w):/);
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

        // Find .reference
        const GITLAB_SCHEMA = new yaml.Schema([
            new yaml.Type("!reference", {
                kind: "sequence",
                construct: function (data) {
                    return {referenceData: data};
                },
            }),
        ]);

        return yaml.load(fileSplitClone.join("\n"), {schema: GITLAB_SCHEMA}) || {};
    }

    getJobByName(name: string): Job {
        const job = this.jobs.get(name);
        assert(job != null, chalk`{blueBright ${name}} could not be found`);
        return job;
    }

    getJobs(): ReadonlyArray<Job> {
        return Array.from(this.jobs.values());
    }

    getStageNames(): ReadonlyArray<string> {
        return Array.from(this.stages.values()).map((s) => s.name);
    }

    getStages(): ReadonlyArray<Stage> {
        return Array.from(this.stages.values());
    }

    private async validateNeedsTags() {
        const stages = Array.from(this.stages.keys());
        const jobNames = Array.from(this.jobs.values()).map((j) => j.name);
        for (const job of this.jobs.values()) {
            if (job.needs === null || job.needs.length === 0) {
                continue;
            }

            const unspecifiedNeedsJob = job.needs.filter((v) => (jobNames.indexOf(v) === -1));
            assert(
                unspecifiedNeedsJob.length !== job.needs.length,
                chalk`[ {blueBright ${unspecifiedNeedsJob.join(",")}} ] jobs are needed by {blueBright ${job.name}}, but they cannot be found`,
            );


            for (const need of job.needs) {
                const needJob = this.getJobByName(need);
                const needJobStageIndex = stages.indexOf(needJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(
                    needJobStageIndex < jobStageIndex,
                    chalk`{blueBright ${needJob.name}} is needed by {blueBright ${job.name}}, but it is in the same or a future stage`,
                );
            }

        }
    }

    static async initGitRemote(cwd: string): Promise<GitRemote> {
        let gitConfig;
        if (fs.existsSync(`${cwd}/.git/config`)) {
            gitConfig = fs.readFileSync(`${cwd}/.git/config`, "utf8");
        } else if (fs.existsSync(`${cwd}/.gitconfig`)) {
            gitConfig = fs.readFileSync(`${cwd}/.gitconfig`, "utf8");
        } else {
            throw new ExitError("Could not locate.gitconfig or .git/config file");
        }

        const match = gitConfig.match(/url = .*@(?<domain>.*?)[:|/](?<group>.*)\/(?<project>.*)\.git/);

        return {
            domain: match?.groups?.domain ?? "",
            group: match?.groups?.group ?? "",
            project: match?.groups?.project ?? "",
        };
    }

    static async downloadIncludeRemote(cwd: string, writeStreams: WriteStreams, url: string): Promise<void> {
        const time = process.hrtime();
        const fsUrl = Utils.fsUrl(url);
        const res = await fetch(url);
        if (res.status !== 200) {
            throw new ExitError(`Remote include could not be fetched ${url}`);
        }
        fs.outputFileSync(`${cwd}/.gitlab-ci-local/includes/${fsUrl}`, await res.text());
        const endTime = process.hrtime(time);
        writeStreams.stdout(chalk`{cyan downloaded} {magentaBright ${url}} in {magenta ${prettyHrtime(endTime)}}\n`);
    }

    static async downloadIncludeProjectFile(cwd: string, writeStreams: WriteStreams, project: string, ref: string, file: string, gitRemoteDomain: string): Promise<void> {
        const time = process.hrtime();
        fs.ensureDirSync(`${cwd}/.gitlab-ci-local/includes/${gitRemoteDomain}/${project}/${ref}/`);
        try {
            await Utils.spawn(`git archive --remote=git@${gitRemoteDomain}:${project}.git ${ref} ${file} | tar -xC .gitlab-ci-local/includes/${gitRemoteDomain}/${project}/${ref}/`, cwd);
        } catch (e) {
            throw new ExitError(`Project include could not be fetched { project: ${project}, ref: ${ref}, file: ${file} }`);
        }

        const endTime = process.hrtime(time);
        const remoteUrl = `${gitRemoteDomain}/${project}/${file}`;
        writeStreams.stdout(chalk`{cyan downloaded} {magentaBright ${remoteUrl}} in {magenta ${prettyHrtime(endTime)}}\n`);
    }

    static async prepareIncludes(gitlabData: any, cwd: string, writeStreams: WriteStreams, gitRemote: GitRemote, tabCompletionPhase: boolean): Promise<any[]> {
        let includeDatas: any[] = [];
        const promises = [];

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of gitlabData["include"] || []) {
            if (tabCompletionPhase) {
                continue;
            }
            if (value["local"]) {
                const fileExists = fs.existsSync(`${cwd}/${value["local"]}`);
                if (!fileExists) {
                    throw new ExitError(`Local include file cannot be found ${value["local"]}`);
                }
            } else if (value["file"]) {
                promises.push(Parser.downloadIncludeProjectFile(cwd, writeStreams, value["project"], value["ref"] || "master", value["file"], gitRemote.domain));
            } else if (value["template"]) {
                const {project, ref, file, domain} = Parser.parseTemplateInclude(value["template"]);
                promises.push(Parser.downloadIncludeProjectFile(cwd, writeStreams, project, ref, file, domain));
            } else if (value["remote"]) {
                promises.push(Parser.downloadIncludeRemote(cwd, writeStreams, value["remote"]));
            }

        }

        await Promise.all(promises);

        for (const value of gitlabData["include"] || []) {
            if (value["local"]) {
                const localDoc = await Parser.loadYaml(`${cwd}/${value.local}`);
                includeDatas = includeDatas.concat(await Parser.prepareIncludes(localDoc, cwd, writeStreams, gitRemote, tabCompletionPhase));
            } else if (value["project"]) {
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${gitRemote.domain}/${value["project"]}/${value["ref"] || "master"}/${value["file"]}`);

                // Expand local includes inside a "project"-like include
                (fileDoc["include"] || []).forEach((inner: any, i: number) => {
                    if (inner["local"]) {
                        fileDoc["include"][i] = { project: value["project"], file: inner["local"].replace(/^\//, ""), ref: value["ref"]};
                    }
                });

                includeDatas = includeDatas.concat(await Parser.prepareIncludes(fileDoc, cwd, writeStreams, gitRemote, tabCompletionPhase));
            } else if (value["template"]) {
                const {project, ref, file, domain} = Parser.parseTemplateInclude(value["template"]);
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${domain}/${project}/${ref}/${file}`);
                includeDatas = includeDatas.concat(await Parser.prepareIncludes(fileDoc, cwd, writeStreams, gitRemote, tabCompletionPhase));
            } else if (value["remote"]) {
                const fsUrl = Utils.fsUrl(value["remote"]);
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${fsUrl}`);
                includeDatas = includeDatas.concat(await Parser.prepareIncludes(fileDoc, cwd, writeStreams, gitRemote, tabCompletionPhase));
            } else {
                throw new ExitError(`Didn't understand include ${JSON.stringify(value)}`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }

    static parseTemplateInclude(template: string): { project: string; ref: string; file: string; domain: string } {
        return {
            domain: "gitlab.com",
            project: "gitlab-org/gitlab",
            ref: "master",
            file: `lib/gitlab/ci/templates/${template}`,
        };
    }
}
