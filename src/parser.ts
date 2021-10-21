import chalk from "chalk";
import deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import prettyHrtime from "pretty-hrtime";
import {Job} from "./job";
import * as jobExpanders from "./job-expanders";
import {Utils} from "./utils";
import {assert} from "./asserts";
import {ParserOptions} from "./types/parser-options";
import {Validator} from "./validator";
import {GitData} from "./git-data";
import {ParserIncludes} from "./parser-includes";
import {Producers} from "./producers";
import {HomeVariables} from "./home-variables";

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

    async init() {
        const cwd = this.opt.cwd;
        const writeStreams = this.opt.writeStreams;
        const home = this.opt.home;
        const file = this.opt.file;
        const fetchIncludes = this.opt.fetchIncludes ?? true;
        const pipelineIid = this.opt.pipelineIid;
        const extraHosts = this.opt.extraHosts || [];
        const volumes = this.opt.volumes || [];

        this._gitData = await GitData.init(cwd);
        this._homeVariables = await HomeVariables.init(cwd, writeStreams, this._gitData, home ?? process.env.HOME ?? "");

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
        jobExpanders.cache(gitlabData);
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
        let noArtifactsToSourceMatch = null;
        let index = 0;
        for (const line of fileSplit) {
            interactiveMatch = !interactiveMatch ? line.match(/#[\s]?@[\s]?[Ii]nteractive/) : interactiveMatch;
            injectSSHAgent = !injectSSHAgent ? line.match(/#[\s]?@[\s]?[Ii]njectSSHAgent/) : injectSSHAgent;
            noArtifactsToSourceMatch = !noArtifactsToSourceMatch ? line.match(/#[\s]?@[\s]?NoArtifactsToSource/i) : noArtifactsToSourceMatch;
            descriptionMatch = !descriptionMatch ? line.match(/#[\s]?@[\s]?[Dd]escription (?<description>.*)/) : descriptionMatch;

            const jobMatch = line.match(/\w:/);
            if (jobMatch && (interactiveMatch || descriptionMatch || injectSSHAgent || noArtifactsToSourceMatch)) {
                if (interactiveMatch) {
                    fileSplitClone.splice(index + 1, 0, "  interactive: true");
                    index++;
                }
                if (injectSSHAgent) {
                    fileSplitClone.splice(index + 1, 0, "  injectSSHAgent: true");
                    index++;
                }
                if (noArtifactsToSourceMatch) {
                    fileSplitClone.splice(index + 1, 0, "  artifactsToSource: false");
                    index++;
                }
                if (descriptionMatch) {
                    fileSplitClone.splice(index + 1, 0, `  description: ${descriptionMatch?.groups?.description ?? ""}`);
                    index++;
                }
                interactiveMatch = null;
                descriptionMatch = null;
                injectSSHAgent = null;
                noArtifactsToSourceMatch = null;
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
