import {WriteStreams} from "./types/write-streams";
import {GitData} from "./git-data";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import path from "path";
import chalk from "chalk";

export class VariablesFromFiles {

    static async init(cwd: string, writeStreams: WriteStreams, gitData: GitData, home: string): Promise<{ [key: string]: string }> {
        const homeDir = home.replace(/\/$/, "");
        const variablesFile = `${homeDir}/.gitlab-ci-local/variables.yml`;
        if (!fs.existsSync(variablesFile)) {
            return {};
        }

        const data: any = yaml.load(await fs.readFile(variablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA});
        let variables: { [key: string]: string } = {};

        for (const [globalKey, globalEntry] of Object.entries(data?.global ?? [])) {
            if (typeof globalEntry !== "string") {
                continue;
            }
            variables[globalKey] = globalEntry;
        }

        const groupUrl = `${gitData.remote.host}/${gitData.remote.group}/`;
        for (const [groupKey, groupEntries] of Object.entries(data?.group ?? [])) {
            if (!groupUrl.includes(this.normalizeProjectKey(groupKey, writeStreams))) {
                continue;
            }
            if (typeof groupEntries !== "object") {
                continue;
            }
            variables = {...variables, ...groupEntries};
        }

        const projectUrl = `${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}.git`;
        for (const [projectKey, projectEntries] of Object.entries(data?.project ?? [])) {
            if (!projectUrl.includes(this.normalizeProjectKey(projectKey, writeStreams))) {
                continue;
            }
            if (typeof projectEntries !== "object") {
                continue;
            }
            variables = {...variables, ...projectEntries};
        }

        const projectVariablesFile = `${cwd}/.gitlab-ci-local-variables.yml`;

        if (fs.existsSync(projectVariablesFile)) {
            const projectEntries: any = yaml.load(await fs.readFile(projectVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA}) ?? {};
            if (typeof projectEntries === "object") {
                variables = {...variables, ...projectEntries};
            }
        }

        // Generate files for file type variables
        for (const [key, value] of Object.entries(variables)) {
            if (typeof value !== "string") {
                continue;
            }
            if (!value.match(/^[/|~]/)) {
                continue;
            }

            if (value.match(/\/$/)) {
                continue;
            }

            const fromFilePath = value.replace(/^~\/(.*)/, `${homeDir}/$1`);
            if (fs.existsSync(fromFilePath)) {
                await fs.ensureDir(`/tmp/gitlab-ci-local-file-variables-${gitData.CI_PROJECT_PATH_SLUG}/`);
                await fs.copyFile(fromFilePath, `/tmp/gitlab-ci-local-file-variables-${gitData.CI_PROJECT_PATH_SLUG}/${path.basename(fromFilePath)}`);
                variables[key] = `/tmp/gitlab-ci-local-file-variables-${gitData.CI_PROJECT_PATH_SLUG}/${path.basename(fromFilePath)}`;
            }
        }

        return variables;
    }

    static normalizeProjectKey(key: string, writeStreams: WriteStreams): string {
        if (!key.includes(":")) return key;
        writeStreams.stderr(chalk`{yellow WARNING: Interpreting '${key}' as '${key.replace(":", "/")}'}\n`);
        return key.replace(":", "/");
    }
}
