import {blueBright, cyan, magenta, magentaBright, yellow} from "ansi-colors";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as path from "path";
import * as prettyHrtime from "pretty-hrtime";
import {Job} from "./job";
import * as jobExpanders from "./job-expanders";
import {Stage} from "./stage";
import * as state from "./state";
import {ExitError} from "./types/exit-error";
import {GitRemote} from "./types/git-remote";
import {GitUser} from "./types/git-user";
import {Utils} from "./utils";
import untildify = require("untildify");

export class Parser {

    private readonly jobs: Map<string, Job> = new Map();
    private readonly stages: Map<string, Stage> = new Map();
    private readonly cwd: string;
    private readonly bashCompletionPhase: boolean;
    private readonly pipelineIid: number;

    private gitRemote: GitRemote | null = null;
    private userVariables: any;

    private gitlabData: any;
    private maxJobNameLength = 0;

    private constructor(cwd: string, pipelineIid: number, bashCompletionPhase = false) {
        this.bashCompletionPhase = bashCompletionPhase;
        this.cwd = cwd;
        this.pipelineIid = pipelineIid;
    }

    static async create(cwd: string, pipelineIid: number, bashCompletionPhase = false) {
        const parser = new Parser(cwd, pipelineIid, bashCompletionPhase);

        const time = process.hrtime();
        await parser.init();
        await parser.initJobs();
        await parser.validateNeedsTags();
        const parsingTime = process.hrtime(time);
        process.stdout.write(`${cyan(`${cwd}/.gitlab-ci.yml`)} ${magentaBright('parsed in')} ${magenta(prettyHrtime(parsingTime))}\n`);

        return parser;
    }

    static async initGitUser(cwd: string): Promise<GitUser> {
        let gitlabUserEmail, gitlabUserName;

        try {
            const {stdout: gitConfigEmail} = await Utils.spawn(`git config user.email`, cwd);
            gitlabUserEmail = gitConfigEmail.trimEnd();
        } catch (e) {
            // process.stderr.write(`${yellow("git config user.email is undefined, defaulting to `local@gitlab.com`")}`);
            gitlabUserEmail = 'local@gitlab.com';
        }

        const gitlabUserLogin = gitlabUserEmail.replace(/@.*/, '');

        try {
            const {stdout: gitConfigUserName} = await Utils.spawn(`git config user.name`, cwd);
            gitlabUserName = gitConfigUserName.trimEnd();
        } catch (e) {
            // process.stderr.write(`${yellow("git config user.name is undefined, defaulting to `Bob Local`")}`);
            gitlabUserName = 'Bob Local';
        }

        return {
            GITLAB_USER_LOGIN: gitlabUserLogin,
            GITLAB_USER_EMAIL: gitlabUserEmail,
            GITLAB_USER_NAME: gitlabUserName
        };
    }

    static async initUserVariables(cwd: string, gitRemote: GitRemote | null, homeDirectory = ''): Promise<{ [key: string]: string }> {
        const variablesFile = `${path.resolve(homeDirectory)}/.gitlab-ci-local/variables.yml`;
        if (!fs.existsSync(variablesFile)) {
            return {};
        }

        const data: any = yaml.load(await fs.readFile(variablesFile, 'utf8'));
        let variables: { [key: string]: string } = {};

        for (const [globalKey, globalEntry] of Object.entries(data?.global ?? [])) {
            if (typeof globalEntry !== 'string') {
                continue;
            }
            variables[globalKey] = globalEntry;
        }

        for (const [groupKey, groupEntires] of Object.entries(data?.group ?? [])) {
            if (!`${gitRemote?.domain}/${gitRemote?.group}/${gitRemote?.project}.git`.includes(groupKey)) {
                continue;
            }
            if (typeof groupEntires !== 'object') {
                continue;
            }
            variables = {...variables, ...groupEntires};
        }

        for (const [projectKey, projectEntries] of Object.entries(data?.project ?? [])) {
            if (!`${gitRemote?.domain}/${gitRemote?.group}/${gitRemote?.project}.git`.includes(projectKey)) {
                continue;
            }
            if (typeof projectEntries !== 'object') {
                continue;
            }
            variables = {...variables, ...projectEntries};
        }

        // Generate files for file type variables
        for (const [key, value] of Object.entries(variables)) {
            if (fs.existsSync(untildify(value))) {
                await fs.ensureDir(`${cwd}/.gitlab-ci-local/file-variables/`);
                await fs.copyFile(untildify(value), `${cwd}/.gitlab-ci-local/file-variables/${path.basename(untildify(value))}`);
                variables[key] = `.gitlab-ci-local/file-variables/${path.basename(untildify(value))}`;
            }
        }

        return variables;
    }

    async init() {
        const cwd = this.cwd;

        this.gitRemote = await Parser.initGitRemote(cwd);
        this.userVariables = await Parser.initUserVariables(cwd, this.gitRemote, process.env.HOME);

        let ymlPath, yamlDataList: any[] = [];
        ymlPath = `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await this.prepareIncludes(gitlabCiData));

        ymlPath = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await this.prepareIncludes(gitlabCiLocalData));

        const gitlabData: any = deepExtend({}, ...yamlDataList);

        // Expand various fields in gitlabData
        jobExpanders.jobExtends(gitlabData);
        jobExpanders.artifacts(gitlabData);
        jobExpanders.image(gitlabData, gitlabData.variables || {});
        jobExpanders.beforeScripts(gitlabData);
        jobExpanders.afterScripts(gitlabData);
        jobExpanders.scripts(gitlabData);

        // If undefined set default array.
        if (!gitlabData.stages) {
            gitlabData.stages = ["build", "test", "deploy"];
        }

        // 'stages:' must be an array
        if (gitlabData.stages && !Array.isArray(gitlabData.stages)) {
            throw new ExitError(`${yellow('stages:')} must be an array`);
        }
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
            if (Job.illigalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }
            this.maxJobNameLength = Math.max(this.maxJobNameLength, jobName.length);
        }

        this.gitlabData = gitlabData;
    }

    async initJobs() {
        const pipelineIid = this.pipelineIid;
        const cwd = this.cwd;
        const gitlabData = this.gitlabData;

        const gitUser = await Parser.initGitUser(cwd);

        // Generate jobs and put them into stages
        for (const [jobName, jobData] of Object.entries(gitlabData)) {
            if (Job.illigalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }

            const jobId = await state.getJobId(cwd);
            const job = new Job(jobData, jobName, cwd, gitlabData, pipelineIid, jobId, this.maxJobNameLength, gitUser, this.userVariables);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                throw new ExitError(`${yellow(`stage:${job.stage}`)} not found for ${blueBright(`${job.name}`)}`);
            }
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
        let index = 0;
        for (const line of fileSplit) {
            interactiveMatch = !interactiveMatch ? line.match(/#[\s]?@[\s]?[Ii]nteractive/) : interactiveMatch;
            descriptionMatch = !descriptionMatch ? line.match(/#[\s]?@[\s]?[Dd]escription (?<description>.*)/) : descriptionMatch;
            const jobMatch = line.match(/(?<jobname>\w):/);
            if (jobMatch && (interactiveMatch || descriptionMatch)) {
                if (interactiveMatch) {
                    fileSplitClone.splice(index + 1, 0, '  interactive: true');
                    index++;
                }
                if (descriptionMatch) {
                    fileSplitClone.splice(index + 1, 0, `  description: ${descriptionMatch?.groups?.description ?? ''}`);
                    index++;
                }
                interactiveMatch = null;
                descriptionMatch = null;
            }
            index++;
        }

        return yaml.load(fileSplitClone.join('\n')) || {};
    }

    getJobByName(name: string): Job {
        const job = this.jobs.get(name);
        if (!job) {
            throw new ExitError(`${blueBright(`${name}`)} could not be found`);
        }
        return job;
    }

    getJobs(): ReadonlyArray<Job> {
        return Array.from(this.jobs.values());
    }

    getJobNames(): ReadonlyArray<string> {
        return Array.from(this.jobs.keys());
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
            if (unspecifiedNeedsJob.length === job.needs.length) {
                throw new ExitError(`[ ${blueBright(unspecifiedNeedsJob.join(','))} ] jobs are needed by ${blueBright(`${job.name}`)}, but they cannot be found`);
            }

            for (const need of job.needs) {
                const needJob = this.jobs.get(need);
                if (needJob && stages.indexOf(needJob.stage) >= stages.indexOf(job.stage)) {
                    throw new ExitError(`${blueBright(`${needJob.name}`)} is needed by ${blueBright(`${job.name}`)}, but it is in the same or a future stage`);
                }
            }

        }
    }

    static async downloadIncludeFile(cwd: string, project: string, ref: string, file: string, gitRemote: GitRemote): Promise<void> {
        fs.ensureDirSync(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/`);
        await Utils.spawn(`git archive --remote=git@${gitRemote.domain}:${project}.git ${ref} ${file} | tar -xC .gitlab-ci-local/includes/${project}/${ref}/`, cwd);

        if (!fs.existsSync(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/${file}`)) {
            throw new ExitError(`Problem fetching git@${gitRemote.domain}:${project}.git ${ref} ${file} does it exist?`);
        }

        return;
    }

    static async initGitRemote(cwd: string): Promise<GitRemote | null> {
        try {
            const {stdout: gitRemote} = await Utils.spawn(`git remote -v`, cwd);
            const match = gitRemote.match(/@(?<domain>.*):(?<group>.*)\/(?<project>.*)\.git \(fetch\)/);

            return {
                domain: match?.groups?.domain ?? '',
                group: match?.groups?.group ?? '',
                project: match?.groups?.project ?? '',
            };
        } catch (e) {
            return null;
        }
    }

    private async prepareIncludes(gitlabData: any): Promise<any[]> {
        let includeDatas: any[] = [];
        const cwd = this.cwd;
        const promises = [];

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of gitlabData["include"] || []) {
            if (!value["file"] || this.bashCompletionPhase) {
                continue;
            }

            if (this.gitRemote == null || this.gitRemote.domain == null) {
                throw new ExitError(`Add a git remote if using include: [{ project: *, file: *}] syntax`);
            }

            promises.push(Parser.downloadIncludeFile(cwd, value["project"], value["ref"] || "master", value["file"], this.gitRemote));
        }

        await Promise.all(promises);

        for (const value of gitlabData["include"] || []) {
            if (value["local"]) {
                const localDoc = await Parser.loadYaml(`${cwd}/${value.local}`);
                includeDatas = includeDatas.concat(await this.prepareIncludes(localDoc));
            } else if (value["file"]) {
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${value["project"]}/${value["ref"] || "master"}/${value["file"]}`);
                includeDatas = includeDatas.concat(await this.prepareIncludes(fileDoc));
            } else {
                throw new ExitError(`Didn't understand include ${JSON.stringify(value)}`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }
}
