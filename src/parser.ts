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
import {assert} from "./asserts";

export class Parser {

    private readonly jobs: Map<string, Job> = new Map();
    private readonly stages: Map<string, Stage> = new Map();
    private readonly cwd: string;
    private readonly file?: string;
    private readonly pipelineIid: number;

    private gitRemote: GitRemote | null = null;
    private userVariables: any;

    private gitlabData: any;
    private maxJobNameLength = 0;
    private readonly tabCompletionPhase: boolean;

    private constructor(cwd: string, pipelineIid: number, tabCompletionPhase: boolean, file?: string) {
        this.cwd = cwd;
        this.pipelineIid = pipelineIid;
        this.tabCompletionPhase = tabCompletionPhase;
        this.file = file;
    }

    static async create(cwd: string, pipelineIid: number, tabCompletionPhase: boolean, file: string) {
        const parser = new Parser(cwd, pipelineIid, tabCompletionPhase, file);

        const time = process.hrtime();
        await parser.init();
        await parser.initJobs();
        await parser.validateNeedsTags();
        const parsingTime = process.hrtime(time);
        if (!tabCompletionPhase) {
            process.stdout.write(`${cyan(`${"yml files".padEnd(parser.maxJobNameLength)}`)} ${magentaBright('processed')} in ${magenta(prettyHrtime(parsingTime))}\n`);
        }

        return parser;
    }

    static async initGitUser(cwd: string): Promise<GitUser> {
        let gitlabUserEmail, gitlabUserName;

        try {
            const {stdout: gitConfigEmail} = await Utils.spawn(`git config user.email`, cwd);
            gitlabUserEmail = gitConfigEmail.trimEnd();
        } catch (e) {
            gitlabUserEmail = 'local@gitlab.com';
        }

        const gitlabUserLogin = gitlabUserEmail.replace(/@.*/, '');

        try {
            const {stdout: gitConfigUserName} = await Utils.spawn(`git config user.name`, cwd);
            gitlabUserName = gitConfigUserName.trimEnd();
        } catch (e) {
            gitlabUserName = 'Bob Local';
        }

        return {
            GITLAB_USER_LOGIN: gitlabUserLogin,
            GITLAB_USER_EMAIL: gitlabUserEmail,
            GITLAB_USER_NAME: gitlabUserName
        };
    }

    static async initUserVariables(cwd: string, gitRemote: GitRemote, homeDirectory = ''): Promise<{ [key: string]: string }> {
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
            if (!`${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}.git`.includes(groupKey)) {
                continue;
            }
            if (typeof groupEntires !== 'object') {
                continue;
            }
            variables = {...variables, ...groupEntires};
        }

        for (const [projectKey, projectEntries] of Object.entries(data?.project ?? [])) {
            if (!`${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}.git`.includes(projectKey)) {
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
        ymlPath = this.file ? `${cwd}/${this.file}` : `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await Parser.prepareIncludes(gitlabCiData, cwd, this.gitRemote, this.tabCompletionPhase));

        ymlPath = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = await Parser.loadYaml(ymlPath);
        yamlDataList = yamlDataList.concat(await Parser.prepareIncludes(gitlabCiLocalData, cwd, this.gitRemote, this.tabCompletionPhase));

        const gitlabData: any = deepExtend({}, ...yamlDataList);

        // Make sure job name's doesn't contain spaces
        // TODO: This deviates from gitlab ci behavior
        Utils.forEachRealJob(gitlabData, jobName => {
            assert(!jobName.includes(' '), `Jobs cannot include spaces, yet! '${jobName}'`);
        });

        // Make sure artifact paths doesn't contain globstar
        // TODO: This deviates from gitlab ci behavior
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            jobData?.artifacts?.paths?.forEach((path: any) => {
                assert(!path.includes('*'), `Artfact paths cannot contain globstar, yet! '${jobName}'`);
            });
        });

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
        assert(gitlabData.stages && Array.isArray(gitlabData.stages), `${yellow('stages:')} must be an array`);

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

        // Check job variables for invalid hash of key value pairs
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            for (const [key, value] of Object.entries(jobData.variables || {})) {
                assert(
                    typeof value === "string" || typeof value === "number",
                    `${blueBright(jobName)} has invalid variables hash of key value pairs. ${key}=${value}`,
                );
            }
        });

        this.gitlabData = gitlabData;
    }

    async initJobs() {
        assert(this.gitRemote != null, "GitRemote isn't set in parser initJobs function")

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
            const job = new Job({
                name: jobName,
                maxJobNameLength: this.maxJobNameLength,
                userVariables: this.userVariables,
                jobData,
                cwd,
                globals: gitlabData,
                pipelineIid,
                jobId,
                gitUser,
                gitRemote: this.gitRemote,
            });
            const stage = this.stages.get(job.stage);
            const stageStr = `stage:${job.stage}`;
            assert(stage != null, `${yellow(stageStr)} not found for ${blueBright(job.name)}`);
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
        assert(job != null, `${blueBright(name)} could not be found`);
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
            assert(
                unspecifiedNeedsJob.length !== job.needs.length,
                `[ ${blueBright(unspecifiedNeedsJob.join(','))} ] jobs are needed by ${blueBright(job.name)}, but they cannot be found`,
            );


            for (const need of job.needs) {
                const needJob = this.getJobByName(need);
                const needJobStageIndex = stages.indexOf(needJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(
                    needJobStageIndex < jobStageIndex,
                    `${blueBright(needJob.name)} is needed by ${blueBright(job.name)}, but it is in the same or a future stage`,
                );
            }

        }
    }

    static async downloadIncludeFile(cwd: string, project: string, ref: string, file: string, gitRemoteDomain: string): Promise<void> {
        const time = process.hrtime();
        fs.ensureDirSync(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/`);
        await Utils.spawn(`git archive --remote=git@${gitRemoteDomain}:${project}.git ${ref} ${file} | tar -xC .gitlab-ci-local/includes/${project}/${ref}/`, cwd);
        const endTime = process.hrtime(time);
        const remoteUrl = `${gitRemoteDomain}/${project}/${file}`;
        process.stdout.write(`${cyan('downloaded')} ${magentaBright(remoteUrl)} in ${magenta(prettyHrtime(endTime))}\n`);
    }

    static async initGitRemote(cwd: string): Promise<GitRemote> {
        let gitConfig;
        if (fs.existsSync(`${cwd}/.git/config`)) {
            gitConfig = fs.readFileSync(`${cwd}/.git/config`, 'utf8')
        } else if (fs.existsSync(`${cwd}/.gitconfig`)) {
            gitConfig = fs.readFileSync(`${cwd}/.gitconfig`, 'utf8')
        } else {
            throw new ExitError(`Could not locate.gitconfig or .git/config file`)
        }

        const match = gitConfig.match(/url = .*@(?<domain>.*?)[:|/](?<group>.*)\/(?<project>.*)/);

        return {
            domain: match?.groups?.domain ?? '',
            group: match?.groups?.group ?? '',
            project: match?.groups?.project ?? '',
        };
    }

    static async prepareIncludes(gitlabData: any, cwd: string, gitRemote: GitRemote, tabCompletionPhase: boolean): Promise<any[]> {
        let includeDatas: any[] = [];
        const promises = [];

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of gitlabData["include"] || []) {
            if (!value["file"] || tabCompletionPhase) {
                continue;
            }

            promises.push(Parser.downloadIncludeFile(cwd, value["project"], value["ref"] || "master", value["file"], gitRemote.domain));
        }

        await Promise.all(promises);

        for (const value of gitlabData["include"] || []) {
            if (value["local"]) {
                const localDoc = await Parser.loadYaml(`${cwd}/${value.local}`);
                includeDatas = includeDatas.concat(await Parser.prepareIncludes(localDoc, cwd, gitRemote, tabCompletionPhase));
            } else if (value["file"]) {
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${value["project"]}/${value["ref"] || "master"}/${value["file"]}`);
                includeDatas = includeDatas.concat(await Parser.prepareIncludes(fileDoc, cwd, gitRemote, tabCompletionPhase));
            } else {
                throw new ExitError(`Didn't understand include ${JSON.stringify(value)}`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }
}
