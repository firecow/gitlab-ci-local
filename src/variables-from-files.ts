import {WriteStreams} from "./types/write-streams";
import {GitData} from "./git-data";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import chalk from "chalk";
import {Argv} from "./argv";
import {assert} from "./asserts";
import {Utils} from "./utils";

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
        const cwd = argv.cwd;
        const homeDir = argv.home;
        const remoteVariables = argv.remoteVariables;
        const homeVariablesFile = `${homeDir}/.gitlab-ci-local/variables.yml`;
        const variables: { [name: string]: CICDVariable } = {};
        let remoteFileData: any = {};
        let homeFileData: any = {};

        if (remoteVariables) {
            const match = remoteVariables.match(/(?<url>git@.*?)=(?<file>.*?)=(?<ref>.*)/);
            assert(match != null, "--remote-variables is malformed use 'git@gitlab.com:firecow/exmaple.git=gitlab-variables.yml=master' syntax");
            const url = match.groups?.url;
            const file = match.groups?.file;
            const ref = match.groups?.ref;
            await fs.ensureDir(`${cwd}/.gitlab-ci-local/variables/`);
            await Utils.bash(`git archive --remote=${url} ${ref} ${file} | tar -xC .gitlab-ci-local/variables/`, cwd);
            remoteFileData = yaml.load(await fs.readFile(`${cwd}/.gitlab-ci-local/variables/${file}`, "utf8"));
        }

        if (await fs.pathExists(homeVariablesFile)) {
            homeFileData = yaml.load(await fs.readFile(homeVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA});
        }

        const unpack  = (v: any): { values: any; type: "file"|"variable"} => {
            if (typeof v === "string") {
                const catchAll: { values: any; type: "file"|"variable"} = { values: {}, type: "variable"};
                catchAll.values = {};
                catchAll.values["*"] = v;
                return catchAll;
            }
            if (v.type == null) {
                v.type = "variable";
            }
            return v;
        };
        const addToVariables = async (key: string, val: any, scopePriority: number) => {
            const {type, values} = unpack(val);
            for (const [matcher, content] of Object.entries(values)) {
                assert(typeof content == "string", `${key}.${matcher} content must be text or multiline text`);
                if (type === "variable" && typeof content === "string" && !content.match(/^[/|~]/)) {
                    const regexp = new RegExp(matcher.replace(/\*/g, ".*"), "g");
                    variables[key] = variables[key] ?? {type: "variable", environments: []};
                    variables[key].environments.push({content, regexp, regexpPriority: matcher.length, scopePriority});
                } else if (type === "variable" && typeof content === "string" && content.match(/^[/|~]/)) {
                    const fileSource = content.replace(/^~\/(.*)/, `${homeDir}/$1`);
                    const regexp = new RegExp(matcher.replace(/\*/g, ".*"), "g");
                    variables[key] = variables[key] ?? {type: "file", environments: []};
                    if (fs.existsSync(fileSource)) {
                        variables[key].environments.push({content, regexp, regexpPriority: matcher.length, scopePriority, fileSource});
                    } else {
                        variables[key].environments.push({content: `warn: ${key} is pointing to invalid path\n`, regexp, regexpPriority: matcher.length, scopePriority});
                    }
                } else if (type === "file") {
                    const regexp = new RegExp(matcher.replace(/\*/g, ".*"), "g");
                    variables[key] = variables[key] ?? {type: "file", environments: []};
                    variables[key].environments.push({content, regexp, regexpPriority: matcher.length, scopePriority });
                } else {
                    assert(false, `${key} was not handled properly`);
                }
            }
        };

        const addVariableFileToVariables = async(fileData: any, filePriority: number) => {
            for (const [globalKey, globalEntry] of Object.entries(fileData?.global ?? {})) {
                await addToVariables(globalKey, globalEntry, 1 + filePriority);
            }

            const groupUrl = `${gitData.remote.host}/${gitData.remote.group}/`;
            for (const [groupKey, groupEntries] of Object.entries(fileData?.group ?? {})) {
                if (!groupUrl.includes(this.normalizeProjectKey(groupKey, writeStreams))) continue;
                assert(groupEntries != null, "groupEntries cannot be null/undefined");
                assert(typeof groupEntries === "object", "groupEntries must be object");
                for (const [k, v] of Object.entries(groupEntries)) {
                    await addToVariables(k, v, 2 + filePriority);
                }
            }

            const projectUrl = `${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}.git`;
            for (const [projectKey, projectEntries] of Object.entries(fileData?.project ?? [])) {
                if (!projectUrl.includes(this.normalizeProjectKey(projectKey, writeStreams))) continue;
                assert(projectEntries != null, "projectEntries cannot be null/undefined");
                assert(typeof projectEntries === "object", "projectEntries must be object");
                for (const [k, v] of Object.entries(projectEntries)) {
                    await addToVariables(k, v, 3 + filePriority);
                }
            }
        };

        await addVariableFileToVariables(remoteFileData, 0);
        await addVariableFileToVariables(homeFileData, 10);

        const projectVariablesFile = `${argv.cwd}/.gitlab-ci-local-variables.yml`;
        if (fs.existsSync(projectVariablesFile)) {
            const projectVariablesFileData: any = yaml.load(await fs.readFile(projectVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA}) ?? {};
            assert(projectVariablesFileData != null, "projectEntries cannot be null/undefined");
            assert(typeof projectVariablesFileData === "object", "projectEntries must be object");
            for (const [k, v] of Object.entries(projectVariablesFileData)) {
                await addToVariables(k, v, 24);
            }
        }

        for (const varObj of Object.values(variables)) {
            varObj.environments.sort((a, b) => b.scopePriority - a.scopePriority);
            varObj.environments.sort((a, b) => b.regexpPriority - a.regexpPriority);
        }

        return variables;
    }

    static normalizeProjectKey(key: string, writeStreams: WriteStreams): string {
        if (!key.includes(":")) return key;
        writeStreams.stderr(chalk`{yellow WARNING: Interpreting '${key}' as '${key.replace(":", "/")}'}\n`);
        return key.replace(":", "/");
    }
}
