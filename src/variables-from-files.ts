import {WriteStreams} from "./types/write-streams";
import {GitData} from "./git-data";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";
import path from "path";
import chalk from "chalk";

export class VariablesFromFiles {

    static async init(cwd: string, writeStreams: WriteStreams, gitData: GitData, home: string): Promise<{ [key: string]: string }> {
        const homeDir = home.replace(/\/$/, "");
        const homeVariablesFile = `${homeDir}/.gitlab-ci-local/variables.yml`;
        let variables: { [key: string]: string } = {};
        let homeFileData: any;
        if (!fs.existsSync(homeVariablesFile)) {
            homeFileData =  {};
        } else {
            homeFileData = yaml.load(await fs.readFile(homeVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA});
        }

        for (const [globalKey, globalEntry] of Object.entries(homeFileData?.global ?? [])) {
            if (typeof globalEntry !== "string") {
                continue;
            }
            variables[globalKey] = globalEntry;
        }

        const groupUrl = `${gitData.remote.host}/${gitData.remote.group}/`;
        for (const [groupKey, groupEntries] of Object.entries(homeFileData?.group ?? [])) {
            if (!groupUrl.includes(this.normalizeProjectKey(groupKey, writeStreams))) {
                continue;
            }
            if (typeof groupEntries !== "object") {
                continue;
            }
            variables = {...variables, ...groupEntries};
        }

        const projectUrl = `${gitData.remote.host}/${gitData.remote.group}/${gitData.remote.project}.git`;
        for (const [projectKey, projectEntries] of Object.entries(homeFileData?.project ?? [])) {
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
            const projectFileData: any = yaml.load(await fs.readFile(projectVariablesFile, "utf8"), {schema: yaml.FAILSAFE_SCHEMA}) ?? {};
            if (typeof projectFileData === "object") {
                variables = {...variables, ...projectFileData};
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
