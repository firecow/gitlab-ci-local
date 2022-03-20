import {WriteStreams} from "./types/write-streams";
import {GitData} from "./git-data";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import chalk from "chalk";
import {Argv} from "./argv";
import {assert} from "./asserts";

export interface CICDVariable {
    type: "file"|"variable";
    environments: {
        content: string;
        regexp: RegExp;
        regexpPriority: number;
        scopePriority: number;
        fileSource?: string;
    }[];
}

export class VariablesFromFiles {

    static async init(argv: Argv, writeStreams: WriteStreams, gitData: GitData): Promise<{ [name: string]: CICDVariable }> {
        const homeDir = argv.home;
        const homeVariablesFile = `${homeDir}/.gitlab-ci-local/variables.yml`;
        const variables: { [name: string]: CICDVariable } = {};
        let homeFileData: any;

        if (!await fs.pathExists(homeVariablesFile)) {
            homeFileData =  {};
        } else {
            homeFileData = yaml.load(await fs.readFile(homeVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA});
        }

        const initAllMatcher = (v: any) => {
            const allEnvironment: {[key: string]: any} = {};
            allEnvironment["*"] = v;
            return allEnvironment;
        };
        const addToVariables = async (key: string, val: any, scopePriority: number) => {
            for (const [envMatcher, content] of Object.entries(typeof val === "string" ? initAllMatcher(val) : val)) {
                if (typeof content === "string" && !content.match(/^[/|~]/)) {
                    const regexp = new RegExp(envMatcher.replace(/\*/g, ".*"), "g");
                    variables[key] = variables[key] ?? {type: "variable", environments: []};
                    variables[key].environments.push({content, regexp, regexpPriority: envMatcher.length, scopePriority});
                } else if (typeof content === "string" && content.match(/^[/|~]/)) {
                    const fileSource = content.replace(/^~\/(.*)/, `${homeDir}/$1`);
                    const regexp = new RegExp(envMatcher.replace(/\*/g, ".*"), "g");
                    variables[key] = variables[key] ?? {type: "file", environments: []};
                    if (fs.existsSync(fileSource)) {
                        variables[key].environments.push({content, regexp, regexpPriority: envMatcher.length, scopePriority, fileSource});
                    } else {
                        variables[key].environments.push({content: `warn: ${key} is pointing to invalid path\n`, regexp, regexpPriority: envMatcher.length, scopePriority});
                    }
                } else {
                    assert(content != null, `${key}.file content cannot be null/undefined`);
                    assert(typeof content == "object", `${key}.${envMatcher}.file must be text or multiline text`);
                    const fileContent = (content as Record<string, string>).file;
                    assert(typeof fileContent == "string", `${key}.${envMatcher}.file must be text or multiline text`);
                    const regexp = new RegExp(envMatcher.replace(/\*/g, ".*"), "g");
                    variables[key] = variables[key] ?? {type: "file", environments: []};
                    variables[key].environments.push({content: fileContent, regexp, regexpPriority: envMatcher.length, scopePriority });
                }
            }
        };

        for (const [globalKey, globalEntry] of Object.entries(homeFileData?.global ?? {})) {
            await addToVariables(globalKey, globalEntry, 0);
        }

        const groupUrl = `${gitData.remote.host}/${gitData.remote.group}/`;
        for (const [groupKey, groupEntries] of Object.entries(homeFileData?.group ?? {})) {
            if (!groupUrl.includes(this.normalizeProjectKey(groupKey, writeStreams))) continue;
            assert(groupEntries != null, "groupEntries cannot be null/undefined");
            assert(typeof groupEntries === "object", "groupEntries must be object");
            for (const [k, v] of Object.entries(groupEntries)) {
                await addToVariables(k, v, 1);
            }
        }

        const projectUrl = `${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}.git`;
        for (const [projectKey, projectEntries] of Object.entries(homeFileData?.project ?? [])) {
            if (!projectUrl.includes(this.normalizeProjectKey(projectKey, writeStreams))) continue;
            assert(projectEntries != null, "projectEntries cannot be null/undefined");
            assert(typeof projectEntries === "object", "projectEntries must be object");
            for (const [k, v] of Object.entries(projectEntries)) {
                await addToVariables(k, v, 2);
            }
        }

        const projectVariablesFile = `${argv.cwd}/.gitlab-ci-local-variables.yml`;
        if (fs.existsSync(projectVariablesFile)) {
            const projectVariablesFileData: any = yaml.load(await fs.readFile(projectVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA}) ?? {};
            assert(projectVariablesFileData != null, "projectEntries cannot be null/undefined");
            assert(typeof projectVariablesFileData === "object", "projectEntries must be object");
            for (const [k, v] of Object.entries(projectVariablesFileData)) {
                await addToVariables(k, v, 3);
            }
        }

        for (const varObj of Object.values(variables)) {
            varObj.environments.sort((a, b) => b.scopePriority - a.scopePriority);
            varObj.environments.sort((a, b) => b.regexpPriority - a.scopePriority);
        }

        return variables;
    }

    static normalizeProjectKey(key: string, writeStreams: WriteStreams): string {
        if (!key.includes(":")) return key;
        writeStreams.stderr(chalk`{yellow WARNING: Interpreting '${key}' as '${key.replace(":", "/")}'}\n`);
        return key.replace(":", "/");
    }
}
