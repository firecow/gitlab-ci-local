import * as c from "ansi-colors";
import * as util from 'util';
import * as childProcess from "child_process";
import * as deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "yaml";
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
    private maxJobNameLength: number = 0;

    private constructor(cwd: string, pipelineIid: number, bashCompletionPhase: boolean = false) {
        this.bashCompletionPhase = bashCompletionPhase;
        this.cwd = cwd;
        this.pipelineIid = pipelineIid;
    }

    public static async create(cwd: any, pipelineIid: number, bashCompletionPhase: boolean = false) {
        const parser = new Parser(cwd, pipelineIid, bashCompletionPhase);
        await parser.init();
        await parser.initJobs();
        await parser.validateNeedsTags();

        return parser;
    }

    public async init() {
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

    public async initJobs() {
        const pipelineIid = this.pipelineIid;
        const cwd = this.cwd;
        const gitlabData = this.gitlabData;
        const promises = [];
        // Generate jobs and put them into stages
        for (const [key, value] of Object.entries(gitlabData)) {
            if (this.illigalJobNames.includes(key) || key[0] === ".") {
                continue;
            }

            const jobId = await state.getJobId(cwd);
            const job = new Job(value, key, gitlabData.stages, cwd, gitlabData, pipelineIid, jobId, this.maxJobNameLength);
            promises.push(job.initRules());
            const stage = this.stages.get(job.stage);
            if (stage) {
                stage.addJob(job);
            } else {
                const stagesJoin = Array.from(this.stages.keys()).join(", ");
                process.stderr.write(`${c.blueBright(`${job.name}`)} uses ${c.yellow(`stage:${job.stage}`)}. Stage cannot be found in [${c.yellow(`${stagesJoin}`)}]\n`);
                process.exit(1);
            }
            await state.incrementJobId(cwd);

            this.jobs.set(key, job);
        }

        await Promise.all(promises);
    }

    public static async loadYaml(filePath: string): Promise<any> {
        const gitlabCiLocalYmlPath = `${filePath}`;
        if (!await fs.existsSync(gitlabCiLocalYmlPath)) {
            return {};
        }

        const fileContent = await fs.readFile(`${filePath}`, "utf8");
        const descRegEx = /#.*?@Description\s?(.*)\s(.*)?:/gm;
        const parse = yaml.parse(fileContent) || {};

        let match;
        while (match = descRegEx.exec(fileContent)) {
            if (match[1] && match[2]) {
                parse[match[2]].description = match[1];
            }
        }

        return parse;
    }

    public getJobByName(name: string): Job {
        const job = this.jobs.get(name);
        if (!job) {
            process.stderr.write(`${c.blueBright(`${name}`)} ${c.red(" could not be found")}\n`);
            process.exit(1);
        }

        return job;
    }

    public getJobs(): ReadonlyArray<Job> {
        return Array.from(this.jobs.values());
    }

    public getJobNames(): ReadonlyArray<string> {
        return Array.from(this.jobs.keys());
    }

    public getStageNames(): ReadonlyArray<string> {
        return Array.from(this.stages.values()).map((s) => s.name);
    }

    public getStages(): ReadonlyArray<Stage> {
        return Array.from(this.stages.values());
    }

    private async validateNeedsTags() {
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
                if (needJob && needJob.stageIndex >= job.stageIndex) {
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

    private static async getGitDomain(cwd: string) {
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

    private async prepareIncludes(doc: any): Promise<any[]> {
        let includeDatas: any[] = [];
        const cwd = this.cwd;
        const promises = [];

        // Find files to fetch from remote and place in .gitlab-ci-local/includes
        for (const value of doc["include"] || []) {
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

        for (const value of doc["include"] || []) {
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

        includeDatas.push(doc);
        return includeDatas;
    }
}
