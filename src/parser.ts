import chalk from "chalk";
import path from "path";
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
const INCLUDE_INPUTS_SUPPORTED_TYPES = ["string", "boolean", "number", "array"] as const;
export type InputType = typeof INCLUDE_INPUTS_SUPPORTED_TYPES[number];

export class Parser {

    private _stages: string[] = [];
    private _gitlabData: any;
    private _jobNamePad: number | null = null;

    readonly jobs: Job[];
    readonly argv: Argv;
    readonly writeStreams: WriteStreams;
    readonly pipelineIid: number;
    readonly expandVariables: boolean;

    private constructor (argv: Argv, writeStreams: WriteStreams, pipelineIid: number, jobs: Job[], expandVariables: boolean) {
        this.argv = argv;
        this.writeStreams = writeStreams;
        this.pipelineIid = pipelineIid;
        this.jobs = jobs;
        this.expandVariables = expandVariables;
    }

    get stages (): readonly string[] {
        return this._stages;
    }

    get gitlabData () {
        return this._gitlabData;
    }

    get jobNamePad (): number {
        return this._jobNamePad ?? 0;
    }

    static async create (argv: Argv, writeStreams: WriteStreams, pipelineIid: number, jobs: Job[], expandVariables: boolean = true) {
        const parser = new Parser(argv, writeStreams, pipelineIid, jobs, expandVariables);
        const time = process.hrtime();
        await parser.init();
        const warnings = await Validator.run(parser.jobs, parser.stages);

        for (const job of parser.jobs) {
            if (job.artifacts === null) {
                job.deleteArtifacts();
            }
        }

        const parsingTime = process.hrtime(time);
        const pathToExpandedGitLabCi = path.join(argv.stateDir, "expanded-gitlab-ci.yml");
        fs.mkdirpSync(argv.stateDir);
        fs.writeFileSync(pathToExpandedGitLabCi, yaml.dump(parser.gitlabData));
        writeStreams.stderr(chalk`{grey parsing and downloads finished in ${prettyHrtime(parsingTime)}.}\n`);

        for (const warning of warnings) {
            writeStreams.stderr(chalk`{yellow ${warning}}\n`);
        }

        // # Second layer of check for errors that are not caught in Validator.run
        if (parser.argv.jsonSchemaValidation) {
            const time = process.hrtime();
            Validator.jsonSchemaValidation({
                pathToExpandedGitLabCi,
                gitLabCiConfig: parser.gitlabData,
            });
            writeStreams.stderr(chalk`{grey json schema validated in ${prettyHrtime(process.hrtime(time))}}\n`);
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
        const gitlabCiData = await Parser.loadYaml(file, {}, this.expandVariables);

        yamlDataList = yamlDataList.concat(await ParserIncludes.init(gitlabCiData, {cwd, stateDir, writeStreams, gitData, fetchIncludes, variables: expanded, expandVariables: this.expandVariables, maximumIncludes: argv.maximumIncludes}));
        ParserIncludes.resetCount();

        const gitlabCiLocalData = await Parser.loadYaml(`${cwd}/.gitlab-ci-local.yml`, {}, this.expandVariables);
        yamlDataList = yamlDataList.concat(await ParserIncludes.init(gitlabCiLocalData, {cwd, stateDir, writeStreams, gitData, fetchIncludes, variables: expanded, expandVariables: this.expandVariables, maximumIncludes: argv.maximumIncludes}));
        ParserIncludes.resetCount();

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
            assert(jobData.when !== "never",
                chalk`This GitLab CI configuration is invalid: jobs:${jobName} when:never can only be used in a rules section or workflow:rules`
            );
            for (const [key, _value] of Object.entries(jobData.variables || {})) {
                let value = _value;
                if (value === null) value = ""; // variable's values are nullable
                assert(
                    typeof value === "string" || typeof value === "number" || typeof value === "boolean",
                    chalk`{blueBright ${jobName}} has invalid variables hash of key value pairs. ${key}=${value}`
                );
                jobData.variables[key] = String(value);
            }

            for (let i = 0; i < (jobData.services ?? []).length; i++) {
                const service = jobData.services[i];
                for (const [key, value] of Object.entries(service.variables || {})) {
                    assert(
                        typeof value === "string" || typeof value === "number" || typeof value === "boolean",
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
            const parallelMatrixVariablesList = parallel.matrixVariablesList(jobData, jobName);
            for (const parallelMatrixVariables of parallelMatrixVariablesList) {
                let matrixJobName = jobName;
                if (parallelMatrixVariables) {
                    matrixJobName = `${jobName}: [${Object.values(parallelMatrixVariables ?? []).join(",")}]`;
                } else if (parallel.isPlainParallel(jobData)) {
                    matrixJobName = `${jobName}: [${nodeIndex}/${parallelMatrixVariablesList.length}]`;
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
                    nodeIndex: (jobData.parallel != null) ? nodeIndex : null,
                    nodesTotal: parallelMatrixVariablesList.length,
                    expandVariables: this.expandVariables,
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
            const jobs = this.argv.job.length !== 0 ? this.argv.job : this.jobs;
            jobs.forEach((job) => {
                let jobNeedsLength: number[] = [];

                if (this.argv.needs && this.argv.job.length > 0) {
                    const found = this.jobs.find(j => j.baseName === job);
                    if (found?.needs) {
                        jobNeedsLength = found.needs.map(f => f.job.length);
                    }
                }
                const jobLength = typeof job == "string" ? job.length : job.name.length;
                this._jobNamePad = Math.max(jobLength, this._jobNamePad ?? 0, ...jobNeedsLength);
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

    static async loadYaml (filePath: string, ctx: any = {}, expandVariables: boolean = true): Promise<any> {
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
        if (expandVariables) {
            for (const line of fileSplit) {
                interactiveMatch = !interactiveMatch ? /#\s?@\s?[Ii]nteractive/.exec(line) : interactiveMatch;
                injectSSHAgent = !injectSSHAgent ? /#\s?@\s?[Ii]njectSSHAgent/.exec(line) : injectSSHAgent;
                noArtifactsToSourceMatch = !noArtifactsToSourceMatch ? /#\s?@\s?NoArtifactsToSource/i.exec(line) : noArtifactsToSourceMatch;
                descriptionMatch = !descriptionMatch ? /#\s?@\s?[Dd]escription (?<description>.*)/.exec(line) : descriptionMatch;

                const jobMatch = /\w:/.exec(line);
                if (jobMatch && (interactiveMatch || descriptionMatch || injectSSHAgent || noArtifactsToSourceMatch)) {
                    if (interactiveMatch) {
                        fileSplitClone.splice(index + 1, 0, "  gclInteractive: true");
                        index++;
                    }
                    if (injectSSHAgent) {
                        fileSplitClone.splice(index + 1, 0, "  gclInjectSSHAgent: true");
                        index++;
                    }
                    if (noArtifactsToSourceMatch) {
                        fileSplitClone.splice(index + 1, 0, "  gclArtifactsToSource: false");
                        index++;
                    }
                    if (descriptionMatch) {
                        fileSplitClone.splice(index + 1, 0, `  gclDescription: ${descriptionMatch?.groups?.description ?? ""}`);
                        index++;
                    }
                    interactiveMatch = null;
                    descriptionMatch = null;
                    injectSSHAgent = null;
                    noArtifactsToSourceMatch = null;
                }
                index++;
            }
        }

        const referenceType = new yaml.Type("!reference", {
            kind: "sequence",
            construct: function (data) {
                return {referenceData: data};
            },
        });
        const schema = yaml.DEFAULT_SCHEMA.extend([referenceType]);
        let fileData;

        try {
            fileData = yaml.loadAll(fileSplitClone.join("\n"), null, {schema}) as any[];
        } catch (e: any) {
            if (e instanceof yaml.YAMLException && e.reason === "duplicated mapping key") {
                console.log(chalk`{black.bgYellowBright  WARN } duplicated mapping key detected! Values will be overwritten!`);
                fileData = yaml.loadAll(fileSplitClone.join("\n"), null, {schema, json: true}) as any[];
            } else {
                throw e;
            }
        }

        if (fileData.length <= 1) return fileData[0];

        if (isGitlabSpecFile(fileData[0])) {
            const inputsSpecification: any = fileData[0];
            const uninterpolatedConfigurations: any = fileData[1];

            const interpolatedConfigurations = JSON.stringify(uninterpolatedConfigurations)
                .replace(
                    /(?<firstChar>.)?(?<secondChar>.)?\$\[\[\s*inputs.(?<interpolationKey>[\w-]+)\s*\|?\s*(?<interpolationFunctions>.*?)\s*\]\](?<lastChar>[^$])?/g // https://regexr.com/81c16
                    , (_: string, firstChar: string, secondChar: string, interpolationKey: string, interpolationFunctions: string, lastChar: string) => {
                        const configFilePath = path.relative(process.cwd(), filePath);
                        const context = {
                            interpolationKey,
                            interpolationFunctions,
                            inputsSpecification,
                            configFilePath,
                            ...ctx,
                        };
                        firstChar ??= "";
                        secondChar ??= "";
                        lastChar ??= "";

                        const {inputValue, inputType} = parseIncludeInputs(context);
                        const firstTwoChar = firstChar + secondChar;
                        switch (inputType) {
                            case "array":
                                if ((secondChar == "\"" && lastChar == "\"") && firstChar != "\\") {
                                    return firstChar + JSON.stringify(inputValue);
                                }

                                // NOTE: This behaves slightly differently from gitlab.com. I can't come up with practical use case so i don't think it's worth the effort to mimic this
                                return firstTwoChar + JSON.stringify(JSON.stringify(inputValue)).slice(1, -1) + lastChar;
                            case "string":
                                return firstTwoChar
                                    + JSON.stringify(inputValue) // ensure a valid json string
                                        .slice(1, -1) // remove the surrounding "
                                    + lastChar;

                            case "number":
                            case "boolean":
                                if ((secondChar == "\"" && lastChar == "\"") && firstChar != "\\") {
                                    return firstChar + inputValue;
                                }
                                return firstTwoChar + inputValue + lastChar;

                            default:
                                Utils.switchStatementExhaustiveCheck(inputType);
                        }
                    });
            return JSON.parse(interpolatedConfigurations);
        }
        return fileData[0];
    }
}

function isGitlabSpecFile (fileData: any) {
    return "spec" in fileData;
}

function validateInterpolationKey (ctx: any) {
    const {configFilePath, interpolationKey, inputsSpecification} = ctx;
    const invalidInterpolationKeyErr = chalk`This GitLab CI configuration is invalid: \`{blueBright ${configFilePath}}\`: unknown interpolation key: \`${interpolationKey}\`.`;
    assert(inputsSpecification.spec.inputs?.[interpolationKey] !== undefined, invalidInterpolationKeyErr);
}

function validateInterpolationFunctions (ctx: any) {
    const {interpolationFunctions, configFilePath} = ctx;
    if (interpolationFunctions != "") {
        console.log(chalk`{black.bgYellowBright  WARN } interpolation functions is currently not supported via gitlab-ci-local. Functions will just be a no-op.`);
    }
    assert(interpolationFunctions.split("|").length <= MAX_FUNCTIONS, chalk`This GitLab CI configuration is invalid: \`{blueBright ${configFilePath}}\`: too many functions in interpolation block.`);
}

function validateInput (ctx: any) {
    const {configFilePath, interpolationKey, inputsSpecification} = ctx;
    const inputValue = getInputValue(ctx);

    const options = inputsSpecification.spec.inputs[interpolationKey]?.options;
    if (options) {
        assert(options.includes(inputValue),
            chalk`This GitLab CI configuration is invalid: \`{blueBright ${configFilePath}}\`: \`{blueBright ${interpolationKey}}\` input: \`{blueBright ${inputValue}}\` cannot be used because it is not in the list of allowed options.`);
    }

    const expectedInputType = getExpectedInputType(ctx);
    assert(INCLUDE_INPUTS_SUPPORTED_TYPES.includes(expectedInputType),
        chalk`This GitLab CI configuration is invalid: \`{blueBright ${configFilePath}}\`: header:spec:inputs:{blueBright ${interpolationKey}} input type unknown value: {blueBright ${expectedInputType}}.`);

    const inputType = Array.isArray(inputValue) ? "array" : typeof inputValue;
    assert(inputType === expectedInputType,
        chalk`This GitLab CI configuration is invalid: \`{blueBright ${configFilePath}}\`: \`{blueBright ${interpolationKey}}\` input: provided value is not a {blueBright ${expectedInputType}}.`);

    const regex = inputsSpecification.spec.inputs[interpolationKey]?.regex;
    if (regex) {
        console.log(chalk`{black.bgYellowBright  WARN } spec:inputs:regex is currently not supported via gitlab-ci-local. This will just be a no-op.`);
    }
}

function parseIncludeInputs (ctx: any): {inputValue: any; inputType: InputType} {
    validateInterpolationKey(ctx);
    validateInterpolationFunctions(ctx);
    validateInput(ctx);
    return {inputValue: getInputValue(ctx), inputType: getExpectedInputType(ctx)};
}

function getInputValue (ctx: any) {
    const {inputs, interpolationKey, configFilePath, inputsSpecification} = ctx;
    const inputValue = inputs[interpolationKey] || inputsSpecification.spec.inputs[interpolationKey]?.default;
    assert(inputValue !== undefined, chalk`This GitLab CI configuration is invalid: \`{blueBright ${configFilePath}}\`: \`{blueBright ${interpolationKey}}\` input: required value has not been provided.`);
    return inputValue;
}

function getExpectedInputType (ctx: any): InputType {
    const {interpolationKey, inputsSpecification} = ctx;
    return inputsSpecification.spec.inputs[interpolationKey]?.type || "string";
}
