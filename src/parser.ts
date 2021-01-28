import {blueBright, red, yellow} from "ansi-colors";
import * as childProcess from "child_process";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import * as path from "path";
import {GitRemote} from "./git-remote";
import {GitUser} from "./git-user";
import {Job} from "./job";
import * as jobExpanders from "./job-expanders";
import {Stage} from "./stage";
import * as state from "./state";
import untildify = require("untildify");
import util = require('util');

const cpExec = util.promisify(childProcess.exec);

export class Parser {

    private readonly jobs: Map<string, Job> = new Map();
    private readonly stages: Map<string, Stage> = new Map();
    private readonly cwd: string;
    private readonly bashCompletionPhase: boolean;
    private readonly pipelineIid: number;

    private gitRemote: GitRemote | null;
    private gitUser: GitUser;
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

        await parser.init();
        await parser.initJobs();
        await parser.validateNeedsTags();

        return parser;
    }

    static async initGitUser(cwd: string): Promise<GitUser> {
        let gitlabUserEmail, gitlabUserName;

        try {
            const res = await cpExec(`git config user.email`, {cwd});
            gitlabUserEmail = res.stdout.trimEnd();
        } catch (e) {
            process.stderr.write(`${yellow("git config user.email is undefined, defaulting to `local@gitlab.com`")}`);
            gitlabUserEmail = 'local@gitlab.com';
        }

        const gitlabUserLogin = gitlabUserEmail.replace(/@.*/, '');

        try {
            const res = await cpExec(`git config user.name`, {cwd});
            gitlabUserName = res.stdout.trimEnd();
        } catch (e) {
            process.stderr.write(`${yellow("git config user.name is undefined, defaulting to `Bob Local`")}`);
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

        this.gitUser = await Parser.initGitUser(cwd);
        this.gitRemote = await Parser.initGitRemote(cwd);
        this.userVariables = await Parser.initUserVariables(cwd, this.gitRemote, process.env.HOME);

        let path, yamlDataList: any[] = [];
        path = `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = await Parser.loadYaml(path);
        yamlDataList = yamlDataList.concat(await this.prepareIncludes(gitlabCiData));

        path = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = await Parser.loadYaml(path);
        yamlDataList = yamlDataList.concat(await this.prepareIncludes(gitlabCiLocalData));

        const gitlabData = deepExtend.apply(this, yamlDataList);

        // Expand various fields in gitlabData
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
        if (gitlabData.stages && !Array.isArray(gitlabData.stages)) {
            process.stderr.write(`${yellow('stages:')} ${red(`must be an array`)}\n`);
            process.exit(1);
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

        // Generate jobs and put them into stages
        for (const [jobName, jobData] of Object.entries(gitlabData)) {
            if (Job.illigalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }

            const jobId = await state.getJobId(cwd);
            const job = new Job(jobData, jobName, cwd, gitlabData, pipelineIid, jobId, this.maxJobNameLength, this.gitUser, this.userVariables);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                process.stderr.write(`${blueBright(`${job.name}`)} uses ${yellow(`stage:${job.stage}`)}. Stage cannot be found in [${yellow(`${stagesJoin}`)}]\n`);
                process.exit(1);
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
            process.stderr.write(`${blueBright(`${name}`)} ${red(" could not be found")}\n`);
            process.exit(1);
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

            if (job.needs.filter((v) => (jobNames.indexOf(v) >= 0)).length !== job.needs.length) {
                process.stderr.write(`${blueBright(`${job.name}`)} needs list contains unspecified jobs.\n`);
                process.exit(1);
            }

            for (const need of job.needs) {
                const needJob = this.jobs.get(need);
                if (needJob && stages.indexOf(needJob.stage) >= stages.indexOf(job.stage)) {
                    process.stderr.write(`${blueBright(`${job.name}`)} cannot need a job from same or future stage. need: ${blueBright(`${needJob.name}`)}\n`);
                    process.exit(1);
                }
            }

        }
    }

    static async downloadIncludeFile(cwd: string, project: string, ref: string, file: string, gitRemote: GitRemote): Promise<void> {
        const gitlabCiLocalPath = `${cwd}/.gitlab-ci-local/includes/${project}/${ref}/`;
        fs.ensureDirSync(gitlabCiLocalPath);

        await cpExec(`git archive --remote=git@${gitRemote.domain}:${project}.git ${ref} ${file} | tar -xC ${gitlabCiLocalPath}`, {
            cwd: gitlabCiLocalPath
        });

        if (!fs.existsSync(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/${file}`)) {
            process.stderr.write(`Problem fetching git@${gitRemote.domain}:${project}.git ${ref} ${file} does it exist?\n`);
            process.exit(1);
        }

        return;
    }

    static async initGitRemote(cwd: string): Promise<GitRemote | null> {
        try {
            const {stdout} = await cpExec(`git remote -v`, {cwd});
            const match = stdout.match(/@(?<domain>.*):(?<group>.*)\/(?<project>.*)\.git \(fetch\)/);

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
            if (!value["file"]) {
                continue;
            }
            if (this.bashCompletionPhase) {
                continue;
            }

            if (this.gitRemote == null || this.gitRemote.domain == null) {
                process.stderr.write(`Problem fetching git origin. You wanna add a remote if using include: { project: *, file: *} \n`);
                process.exit(1);
            }

            promises.push(Parser.downloadIncludeFile(cwd, value["project"], value["ref"] || "master", value["file"], this.gitRemote));
        }

        await Promise.all(promises);

        for (const value of gitlabData["include"] || []) {
            if (value["local"]) {
                const localDoc = await Parser.loadYaml(`${this.cwd}/${value.local}`);
                includeDatas = includeDatas.concat(await this.prepareIncludes(localDoc));
            } else if (value["file"]) {
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${value["project"]}/${value["ref"] || "master"}/${value["file"]}`);
                includeDatas = includeDatas.concat(await this.prepareIncludes(fileDoc));
            } else {
                process.stderr.write(`Didn't understand include ${JSON.stringify(value)}\n`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }
}
