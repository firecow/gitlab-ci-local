import * as c from "ansi-colors";
import * as util from 'util';
import * as childProcess from "child_process";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import {Job} from "./job";
import * as state from "./state";
import {Stage} from "./stage";

const cpExec = util.promisify(childProcess.exec);

export class Parser {

    private readonly illigalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "workflow",
    ];
    private readonly jobs: Map<string, Job> = new Map();
    private readonly stages: Map<string, Stage> = new Map();
    private readonly cwd: string;
    private readonly bashCompletionPhase: boolean;
    private readonly pipelineIid: number;

    private gitDomain: string|null;
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

    private async initGitlabUser(): Promise<{ GITLAB_USER_EMAIL: string, GITLAB_USER_LOGIN: string, GITLAB_USER_NAME: string }> {
        let gitlabUserEmail, gitlabUserName;

        try {
            const res = await cpExec(`git config user.email`, {cwd: this.cwd});
            gitlabUserEmail = res.stdout.trimEnd();
        } catch (e) {
            // process.stderr.write(`${c.yellow("git config user.email is undefined, defaulting to `local@gitlab.com`")}`)
            gitlabUserEmail = 'local@gitlab.com';
        }

        const gitlabUserLogin = gitlabUserEmail.replace(/@.*/, '');

        try {
            const res = await cpExec(`git config user.name`, {cwd: this.cwd});
            gitlabUserName = res.stdout.trimEnd();
        } catch (e) {
            // process.stderr.write(`${c.yellow("git config user.name is undefined, defaulting to `Bob Local`")}`)
            gitlabUserName = 'Bob Local';
        }

        return {
            GITLAB_USER_LOGIN: gitlabUserLogin,
            GITLAB_USER_EMAIL: gitlabUserEmail,
            GITLAB_USER_NAME: gitlabUserName
        };
    }

    async init() {
        const cwd = this.cwd;

        let path;
        let yamlDataList: any[] = [];

        this.gitDomain = await Parser.getGitDomain(cwd);

        path = `${cwd}/.gitlab-ci.yml`;
        const gitlabCiData = await Parser.loadYaml(path);
        yamlDataList = yamlDataList.concat(await this.prepareIncludes(gitlabCiData));

        path = `${cwd}/.gitlab-ci-local.yml`;
        const gitlabCiLocalData = await Parser.loadYaml(path);
        yamlDataList = yamlDataList.concat(await this.prepareIncludes(gitlabCiLocalData));

        const gitlabData = deepExtend.apply(this, yamlDataList);

        // Generate stages. We'll do our best to replicate what the gitlab-org runner does.
        // If there's no stages defined by the user, the following stages must be defined.
        // Please see: https://docs.gitlab.com/ee/ci/yaml/#stages
        if (!gitlabData.stages) {
            gitlabData.stages = ["build", "test", "deploy"];
        }

        // Validate that 'stages:' is array
        if (gitlabData.stages && !Array.isArray(gitlabData.stages)) {
            process.stderr.write(`${c.red(`'stages:' must be an array`)}\n`);
            process.exit(1);
        }

        // ".pre" and ".post" are always present. See: https://docs.gitlab.com/ee/ci/yaml/#pre-and-post
        gitlabData.stages.unshift(".pre");
        gitlabData.stages.push(".post");

        // Create stages and set into Map
        for (const value of gitlabData.stages || []) {
            this.stages.set(value, new Stage(value));
        }

        // Find longest job name
        for (const key of Object.keys(gitlabData)) {
            if (this.illigalJobNames.includes(key) || key[0] === ".") {
                continue;
            }
            this.maxJobNameLength = Math.max(this.maxJobNameLength, key.length);
        }

        this.gitlabData = gitlabData;
    }

    async initJobs() {
        const pipelineIid = this.pipelineIid;
        const cwd = this.cwd;
        const gitlabData = this.gitlabData;
        const gitlabUser = await this.initGitlabUser();

        // Generate jobs and put them into stages
        for (const [jobName, value] of Object.entries(gitlabData)) {
            if (this.illigalJobNames.includes(jobName) || jobName[0] === ".") {
                continue;
            }

            const jobId = await state.getJobId(cwd);
            const job = new Job(value, jobName, cwd, gitlabData, pipelineIid, jobId, this.maxJobNameLength, gitlabUser);
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                process.stderr.write(`${c.blueBright(`${job.name}`)} uses ${c.yellow(`stage:${job.stage}`)}. Stage cannot be found in [${c.yellow(`${stagesJoin}`)}]\n`);
                process.exit(1);
            }
            await state.incrementJobId(cwd);

            this.jobs.set(jobName, job);
        }

    }

    static async loadYaml(filePath: string): Promise<any> {
        const ymlPath = `${filePath}`;
        if (!await fs.existsSync(ymlPath)) {
            return {};
        }

        const fileContent = await fs.readFile(`${filePath}`, "utf8");
        const fileSplit = fileContent.split(/\r?\n/g);
        const fileSplitClone = fileSplit.slice();

        let interactiveMatch = null;
        let descriptionMatch = null
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
            process.stderr.write(`${c.blueBright(`${name}`)} ${c.red(" could not be found")}\n`);
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
                process.stderr.write(`${c.blueBright(`${job.name}`)} needs list contains unspecified jobs.\n`);
                process.exit(1);
            }

            for (const need of job.needs) {
                const needJob = this.jobs.get(need);
                if (needJob && stages.indexOf(needJob.stage) >= stages.indexOf(job.stage)) {
                    process.stderr.write(`${c.blueBright(`${job.name}`)} cannot need a job from same or future stage. need: ${c.blueBright(`${needJob.name}`)}\n`);
                    process.exit(1);
                }
            }

        }
    }

    private static async downloadIncludeFile(cwd: string, project: string, ref: string, file: string, gitDomain: string): Promise<void>{
        const gitlabCiLocalPath = `${cwd}/.gitlab-ci-local/includes/${project}/${ref}/`;
        fs.ensureDirSync(gitlabCiLocalPath);

        await cpExec(`git archive --remote=git@${gitDomain}:${project}.git ${ref} ${file} | tar -xC ${gitlabCiLocalPath}`, {
            cwd: gitlabCiLocalPath
        });

        if (!fs.existsSync(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/${file}`)) {
            process.stderr.write(`Problem fetching git@${gitDomain}:${project}.git ${ref} ${file} does it exist?\n`);
            process.exit(1);
        }

        return;
    }

    private static async getGitDomain(cwd: string): Promise<string|null> {
        const domainRegExp = /^.*@(.*):.*\(fetch\)/;
        try {
            const {stdout} = await cpExec(`git remote -v`, { cwd });
            const exec = domainRegExp.exec(`${stdout}`);
            if (exec === null) {
                return null;
            }
            return exec[1];
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

            const ref = value["ref"] || "master";
            const file = value["file"];
            const project = value["project"];

            if (this.gitDomain === null) {
                process.stderr.write(`Problem fetching git origin. You wanna add a remote if using include: { project: *, file: *} \n`);
                process.exit(1);
            }

            promises.push(Parser.downloadIncludeFile(cwd, project, ref, file, this.gitDomain));
        }

        await Promise.all(promises);

        for (const value of gitlabData["include"] || []) {
            if (value["local"]) {
                const localDoc = await Parser.loadYaml(`${this.cwd}/${value.local}`);
                includeDatas = includeDatas.concat(await this.prepareIncludes(localDoc));
            } else if (value["file"]) {
                const ref = value["ref"] || "master";
                const file = value["file"];
                const project = value["project"];
                const fileDoc = await Parser.loadYaml(`${cwd}/.gitlab-ci-local/includes/${project}/${ref}/${file}`);
                includeDatas = includeDatas.concat(await this.prepareIncludes(fileDoc));
            } else {
                process.stderr.write(`Didn't understand include ${JSON.stringify(value)}\n`);
            }
        }

        includeDatas.push(gitlabData);
        return includeDatas;
    }
}
