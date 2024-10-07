import {WriteStreams} from "./write-streams";
import {GitData} from "./git-data";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import chalk from "chalk";
import {Argv} from "./argv";
import assert from "assert";
import {Utils} from "./utils";
import dotenv from "dotenv";

export interface CICDVariable {
    type: "file" | "variable";
    environments: {
        content: string;
        regexp: RegExp;
        regexpPriority: number;
        scopePriority: number;
        fileSource?: string;
    }[];
}

export class VariablesFromFiles {

    static async init (argv: Argv, writeStreams: WriteStreams, gitData: GitData): Promise<{[name: string]: CICDVariable}> {
        const cwd = argv.cwd;
        const stateDir = argv.stateDir;
        const homeDir = argv.home;
        const remoteVariables = argv.remoteVariables;
        const autoCompleting = argv.autoCompleting;
        const homeVariablesFile = `${homeDir}/${stateDir}/variables.yml`;
        const variables: {[name: string]: CICDVariable} = {};
        let remoteFileData: any = {};
        let homeFileData: any = {};

        if (remoteVariables && !autoCompleting) {
            const match = /(?<url>git@.*?)=(?<file>.*?)=(?<ref>.*)/.exec(remoteVariables);
            assert(match != null, "--remote-variables is malformed use 'git@gitlab.com:firecow/example.git=gitlab-variables.yml=master' syntax");
            const url = match.groups?.url;
            const file = match.groups?.file;
            const ref = match.groups?.ref;
            const res = await Utils.bash(`set -eou pipefail; git archive --remote=${url} ${ref} ${file} | tar -xO ${file}`, cwd);
            remoteFileData = yaml.load(`${res.stdout}`);
        }

        if (await fs.pathExists(homeVariablesFile)) {
            homeFileData = yaml.load(await fs.readFile(homeVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA});
        }

        const unpack = (v: any): {values: any; type: "file" | "variable" | null} => {
            if (typeof v === "string") {
                const catchAll: {values: any; type: "file" | "variable" | null} = {values: {}, type: null};
                catchAll.values = {};
                catchAll.values["*"] = v;
                return catchAll;
            } else {
                v.type = v.type ?? "variable";
            }
            return v;
        };
        const addToVariables = async (key: string, val: any, scopePriority: number, isDotEnv = false) => {
            const {type, values} = unpack(val);
            for (const [matcher, content] of Object.entries(values)) {
                assert(typeof content == "string", `${key}.${matcher} content must be text or multiline text`);
                if (isDotEnv || type === "variable" || (type === null && !/^[/|~]/.exec(content))) {
                    const regexp = matcher === "*" ? /.*/g : new RegExp(`^${matcher.replace(/\*/g, ".*")}$`, "g");
                    variables[key] = variables[key] ?? {type: "variable", environments: []};
                    variables[key].environments.push({content, regexp, regexpPriority: matcher.length, scopePriority});
                } else if (type === null && /^[/|~]/.exec(content)) {
                    const fileSource = content.replace(/^~\/(.*)/, `${homeDir}/$1`);
                    const regexp = matcher === "*" ? /.*/g : new RegExp(`^${matcher.replace(/\*/g, ".*")}$`, "g");
                    variables[key] = variables[key] ?? {type: "file", environments: []};
                    if (fs.existsSync(fileSource)) {
                        variables[key].environments.push({content, regexp, regexpPriority: matcher.length, scopePriority, fileSource});
                    } else {
                        variables[key].environments.push({content: `warn: ${key} is pointing to invalid path\n`, regexp, regexpPriority: matcher.length, scopePriority});
                    }
                } else if (type === "file") {
                    const regexp = matcher === "*" ? /.*/g : new RegExp(`^${matcher.replace(/\*/g, ".*")}$`, "g");
                    variables[key] = variables[key] ?? {type: "file", environments: []};
                    variables[key].environments.push({content, regexp, regexpPriority: matcher.length, scopePriority});
                } else {
                    assert(false, `${key} was not handled properly`);
                }
            }
        };

        const addVariableFileToVariables = async (fileData: any, filePriority: number) => {
            for (const [globalKey, globalEntry] of Object.entries(fileData?.global ?? {})) {
                await addToVariables(globalKey, globalEntry, 1 + filePriority);
            }

            const groupUrl = `${gitData.remote.host}/${gitData.remote.group}/`;
            for (const [groupKey, groupEntries] of Object.entries(fileData?.group ?? {})) {
                if (!groupUrl.includes(this.normalizeProjectKey(groupKey, writeStreams))) continue;
                assert(groupEntries != null, "groupEntries cannot be null/undefined");
                assert(Utils.isObject(groupEntries), "group entries in variable files must be an object");
                for (const [k, v] of Object.entries(groupEntries)) {
                    await addToVariables(k, v, 2 + filePriority);
                }
            }

            const projectUrl = `${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}.git`;
            for (const [projectKey, projectEntries] of Object.entries(fileData?.project ?? [])) {
                if (!projectUrl.includes(this.normalizeProjectKey(projectKey, writeStreams))) continue;
                assert(projectEntries != null, "projectEntries cannot be null/undefined");
                assert(Utils.isObject(projectEntries), "project entries in variable files must be an object");
                for (const [k, v] of Object.entries(projectEntries)) {
                    await addToVariables(k, v, 3 + filePriority);
                }
            }
        };

        await addVariableFileToVariables(remoteFileData, 0);
        await addVariableFileToVariables(homeFileData, 10);

        const projectVariablesFile = `${argv.cwd}/${argv.variablesFile}`;
        if (fs.existsSync(projectVariablesFile)) {
            let isDotEnvFormat = false;
            const projectVariablesFileRawContent = await fs.readFile(projectVariablesFile, "utf8");
            let projectVariablesFileData;
            try {
                projectVariablesFileData = yaml.load(projectVariablesFileRawContent, {schema: yaml.FAILSAFE_SCHEMA}) ?? {};

                if (typeof(projectVariablesFileData) === "string") {
                    isDotEnvFormat = true;
                    projectVariablesFileData = dotenv.parse(projectVariablesFileRawContent);
                }
            } catch (e) {
                if (e instanceof yaml.YAMLException) {
                    isDotEnvFormat = true;
                    projectVariablesFileData = dotenv.parse(projectVariablesFileRawContent);
                }
            }
            assert(projectVariablesFileData != null, "projectEntries cannot be null/undefined");
            assert(Utils.isObject(projectVariablesFileData), `${argv.cwd}/.gitlab-ci-local-variables.yml must contain an object`);
            for (const [k, v] of Object.entries(projectVariablesFileData)) {
                await addToVariables(k, v, 24, isDotEnvFormat);
            }
        }

        for (const varObj of Object.values(variables)) {
            varObj.environments.sort((a, b) => b.scopePriority - a.scopePriority);
            varObj.environments.sort((a, b) => b.regexpPriority - a.regexpPriority);
        }

        return variables;
    }

    static normalizeProjectKey (key: string, writeStreams: WriteStreams): string {
        if (!key.includes(":")) return key;
        writeStreams.stderr(chalk`{yellow WARNING: Interpreting '${key}' as '${key.replace(":", "/")}'}\n`);
        return key.replace(":", "/");
    }
}
