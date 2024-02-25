import chalk from "chalk";
import deepExtend from "deep-extend";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import prettyHrtime from "pretty-hrtime";
import {Job} from "./job";
import * as DataExpander from "./data-expander";
import {Utils} from "./utils";
import assert from "assert";
import {Validator} from "./validator";
import * as parallel from "./parallel";
import {GitData} from "./git-data";
import {ParserIncludes} from "./parser-includes";
import {Producers} from "./producers";
import {VariablesFromFiles} from "./variables-from-files";
import {Argv} from "./argv";
import {WriteStreams} from "./write-streams";
import {init as initPredefinedVariables} from "./predefined-variables";

const MAX_FUNCTIONS = 3;
const INCLUDE_INPUTS_SUPPORTED_TYPES = ["string", "boolean", "number"];

export class Parser {

    private _stages: string[] = [];
    private _gitlabData: any;
    private _jobNamePad: number | null = null;

    readonly jobs: Job[];
    readonly argv: Argv;
    readonly writeStreams: WriteStreams;
    readonly pipelineIid: number;

    private constructor (argv: Argv, writeStreams: WriteStreams, pipelineIid: number, jobs: Job[]) {
        this.argv = argv;
        this.writeStreams = writeStreams;
        this.pipelineIid = pipelineIid;
        this.jobs = jobs;
    }

    get stages (): readonly string[] {
        return this._stages;
    }

    get gitlabData () {
        return this._gitlabData;
    }

    get jobNamePad (): number {
        assert(this._jobNamePad != null, "jobNamePad is uninitialized");
        return this._jobNamePad;
    }

    static async create (argv: Argv, writeStreams: WriteStreams, pipelineIid: number, jobs: Job[]) {
        const parser = new Parser(argv, writeStreams, pipelineIid, jobs);
        const time = process.hrtime();
        await parser.init();
        const warnings = await Validator.run(parser.jobs, parser.stages);
        const parsingTime = process.hrtime(time);

        writeStreams.stderr(chalk`{grey parsing and downloads finished} in {grey ${prettyHrtime(parsingTime)}}\n`);
        for (const warning of warnings) {
            writeStreams.stderr(chalk`{yellow ${warning}}\n`);
        }

        return parser;
    }

    async init () {
        const argv = this.argv;
        const cwd = argv.cwd;
        const stateDir = argv.stateDir;
        const writeStreams = this.writeStreams;
        const file = argv.file;
        const pipelineIid = this.pipelineIid;
        const fetchIncludes = argv.fetchIncludes;
        const gitData = await GitData.init(cwd, writeStreams);
        const variablesFromFiles = await VariablesFromFiles.init(argv, writeStreams, gitData);
        const predefinedVariables = initPredefinedVariables({gitData, argv});
        const envMatchedVariables = Utils.findEnvMatchedVariables(variablesFromFiles);
        const variables = {...predefinedVariables, ...envMatchedVariables, ...argv.variable};
        const expanded = Utils.expandVariables(variables);

        let yamlDataList: any[] = [{stages: [".pre", "build", "test", "deploy", ".post"]}];
        const gitlabCiData = await Parser.loadYaml(`${cwd}/${file}`);
        yamlDataList = yamlDataList.concat(await ParserIncludes.init(gitlabCiData, 0, {cwd, stateDir, writeStreams, gitData, fetchIncludes, excludedGlobs: [], variables: expanded}));

        const gitlabCiLocalData = await Parser.loadYaml(`${cwd}/.gitlab-ci-local.yml`);
        yamlDataList = yamlDataList.concat(await ParserIncludes.init(gitlabCiLocalData, 0, {cwd, stateDir, writeStreams, gitData, fetchIncludes, excludedGlobs: [], variables: expanded}));

        const gitlabData: any = deepExtend({}, ...yamlDataList);

        // Expand various fields in gitlabData
        DataExpander.jobExtends(gitlabData);
        DataExpander.reference(gitlabData, gitlabData);
        DataExpander.complexObjects(gitlabData);
        DataExpander.defaults(gitlabData);
        DataExpander.globalVariables(gitlabData);
        DataExpander.flattenLists(gitlabData);

        assert(gitlabData.stages && Array.isArray(gitlabData.stages), chalk`{yellow stages:} must be an array`);
        if (!gitlabData.stages.includes(".pre")) {
            gitlabData.stages.unshift(".pre");
        }
        if (!gitlabData.stages.includes(".post")) {
            gitlabData.stages.push(".post");
        }
        this._stages = gitlabData.stages;

        // Check job variables for invalid hash of key value pairs, and cast numbers to strings
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            for (const [key, _value] of Object.entries(jobData.variables || {})) {
                let value = _value;
                if (value === null) value = ""; // variable's values are nullable
                assert(
                    typeof value === "string" || typeof value === "number",
                    chalk`{blueBright ${jobName}} has invalid variables hash of key value pairs. ${key}=${value}`
                );
                jobData.variables[key] = String(value);
            }

            for (let i = 0; i < (jobData.services ?? []).length; i++) {
                const service = jobData.services[i];
                for (const [key, value] of Object.entries(service.variables || {})) {
                    assert(
                        typeof value === "string" || typeof value === "number",
                        chalk`{blueBright ${jobName}.services[${i}]} has invalid variables hash of key value pairs. ${key}=${value}`
                    );
                    jobData.services[i].variables[key] = String(value);
                }
            }
        });

        this._gitlabData = gitlabData;

        // Generate jobs and put them into stages
        Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
            assert(gitData != null, "gitData must be set");
            assert(variablesFromFiles != null, "homeVariables must be set");

            let nodeIndex = 1;
            const parallelMatrixVariablesList = parallel.matrixVariablesList(jobData, jobName) ?? [null];
            for (const parallelMatrixVariables of parallelMatrixVariablesList) {
                let matrixJobName = jobName;
                if (parallelMatrixVariables) {
                    matrixJobName = `${jobName}: [${Object.values(parallelMatrixVariables ?? []).join(",")}]`;
                }

                const job = new Job({
                    argv,
                    writeStreams,
                    data: jobData,
                    name: matrixJobName,
                    baseName: jobName,
                    globalVariables: gitlabData.variables,
                    pipelineIid: pipelineIid,
                    predefinedVariables,
                    gitData,
                    variablesFromFiles,
                    matrixVariables: parallelMatrixVariables,
                    nodeIndex: parallelMatrixVariables !== null ? nodeIndex : null,
                    nodesTotal: parallelMatrixVariablesList.length,
                });
                const foundStage = this.stages.includes(job.stage);
                assert(foundStage, chalk`{yellow stage:${job.stage}} not found for {blueBright ${job.name}}`);
                this.jobs.push(job);
                nodeIndex++;
            }
        });

        // Add some padding so that job logs are nicely aligned
        // allow users to override this in case they have really long job name (see #840)
        if (this.argv.maxJobNamePadding !== null && this.argv.maxJobNamePadding <= 0) {
            this._jobNamePad = 0;
        } else {
            this.jobs.forEach((job) => {
                this._jobNamePad = Math.max(job.name.length, this._jobNamePad ?? 0);
            });
            if (this.argv.maxJobNamePadding !== null) {
                this._jobNamePad = Math.min(this.argv.maxJobNamePadding ?? 0, this._jobNamePad ?? 0);
            }
        }

        // Set jobNamePad on all jobs
        this.jobs.forEach((job) => {
            job.jobNamePad = this.jobNamePad;
        });

        // Generate producers for each job
        this.jobs.forEach((job) => {
            job.producers = Producers.init(this.jobs, this.stages, job);
        });
    }

    static async loadYaml (filePath: string, ctx: any = {}): Promise<any> {
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
            interactiveMatch = !interactiveMatch ? /#\s?@\s?[Ii]nteractive/.exec(line) : interactiveMatch;
            injectSSHAgent = !injectSSHAgent ? /#\s?@\s?[Ii]njectSSHAgent/.exec(line) : injectSSHAgent;
            noArtifactsToSourceMatch = !noArtifactsToSourceMatch ? /#\s?@\s?NoArtifactsToSource/i.exec(line) : noArtifactsToSourceMatch;
            descriptionMatch = !descriptionMatch ? /#\s?@\s?[Dd]escription (?<description>.*)/.exec(line) : descriptionMatch;

            const jobMatch = /\w:/.exec(line);
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
        const fileData = yaml.loadAll(fileSplitClone.join("\n"), null, {schema}) as any[];

        if (fileData.length == 1) return fileData[0];

        if ("spec" in fileData[0]) {
            const inputsSpecification: any = fileData[0];
            const uninterpolatedConfigurations: any = fileData[1];

            const result = JSON.stringify(uninterpolatedConfigurations)
                .replace(
                    /\$\[\[\s*inputs.(?<interpolationKey>\w+)\s*\|?\s*(?<interpolationFunctions>.*?)\s*\]\]/g // regexr.com/7sh15
                    , (_: string, interpolationKey: string, interpolationFunctions) => {
                        if (interpolationFunctions != "") {
                            console.log(chalk`{black.bgYellowBright  WARN } interpolation functions is currently not supported via gitlab-ci-local. Functions will just be a no-op.`);
                        }
                        assert(interpolationFunctions.split("|").length <= MAX_FUNCTIONS, chalk`This GitLab CI configuration is invalid: \`{blueBright ${filePath}}\`: too many functions in interpolation block.`);

                        let inputValue = ctx.inputs[interpolationKey];
                        if (inputValue === undefined) {
                            let inputSpec;
                            try {
                                inputSpec = inputsSpecification.spec.inputs[interpolationKey];
                            } catch (e) {
                                assert(!(e instanceof TypeError),
                                    chalk`This GitLab CI configuration is invalid: \`{blueBright ${filePath}}\`: unknown interpolation key: \`${interpolationKey}\`.`);
                            }
                            try {
                                inputValue = inputSpec["default"];
                            } catch (e) {
                                assert(!(e instanceof TypeError),
                                    chalk`This GitLab CI configuration is invalid: \`{blueBright ${filePath}}\`: \`{blueBright ${interpolationKey}}\` input: required value has not been provided.`);
                            }
                        }

                        const valueOptions = inputsSpecification.spec.inputs[interpolationKey]?.options;
                        if (valueOptions) {
                            assert(valueOptions.includes(inputValue),
                                chalk`This GitLab CI configuration is invalid: \`{blueBright ${filePath}}\`: \`{blueBright ${interpolationKey}}\` input: \`{blueBright ${inputValue}}\` cannot be used because it is not in the list of allowed options.`);
                        }

                        const inputType = inputsSpecification.spec.inputs[interpolationKey]?.type || "string";
                        assert(INCLUDE_INPUTS_SUPPORTED_TYPES.includes(inputType),
                            chalk`This GitLab CI configuration is invalid: \`{blueBright ${filePath}}\`: header:spec:inputs:{blueBright ${interpolationKey}} input type unknown value: {blueBright ${inputType}}.`);
                        assert(typeof inputValue == inputType,
                            chalk`This GitLab CI configuration is invalid: \`{blueBright ${filePath}}\`: \`{blueBright ${interpolationKey}}\` input: provided value is not a {blueBright ${inputType}}.`);

                        const regex = inputsSpecification.spec.inputs[interpolationKey]?.regex;
                        if (regex) {
                            console.log(chalk`{black.bgYellowBright  WARN } spec:inputs:regex is currently not supported via gitlab-ci-local. This will just be a no-op.`);
                        }

                        return inputValue;
                    });
            return JSON.parse(result);
        }
        return fileData[0];
    }
}
