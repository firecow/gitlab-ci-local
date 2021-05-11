import * as chalk from "chalk";
import * as childProcess from "child_process";
import * as fs from "fs-extra";
import * as prettyHrtime from "pretty-hrtime";
import * as camelCase from "camelcase";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";
import {JobOptions} from "./types/job-options";
import {WriteStreams} from "./types/write-streams";

export class Job {

    static readonly illegalJobNames = [
        "include", "local_configuration", "image", "services",
        "stages", "pages", "types", "before_script", "default",
        "after_script", "variables", "cache", "workflow",
    ];

    readonly name: string;
    readonly jobNamePad: number;
    readonly needs: string[] | null;
    readonly dependencies: string[] | null;
    readonly environment?: { name: string; url: string | null };
    readonly jobId: number;
    readonly cwd: string;
    readonly rules?: { if: string; when: string; allow_failure: string | boolean }[];
    readonly expandedVariables: { [key: string]: string };
    readonly allowFailure: boolean;
    readonly when: string;
    readonly pipelineIid: number;
    readonly cache: { key: string | { files: string[] }; paths: string[] };

    private _prescriptsExitCode: number | null = null;
    private _afterScriptsExitCode = 0;
    private _coveragePercent: string | null = null;
    private _running = false;
    private _containerId: string | null = null;
    private _artifactsContainerId: string | null = null;
    private _containerVolumeName: string | null = null;
    private _longRunningSilentTimeout: NodeJS.Timeout = -1 as any;

    private readonly jobData: any;
    private readonly writeStreams: WriteStreams;
    private readonly extraHosts: string[];

    constructor(opt: JobOptions) {
        const jobData = opt.data;
        const gitUser = opt.gitUser;
        const gitRemote = opt.gitRemote;
        const globals = opt.globals;
        const homeVariables = opt.homeVariables;

        this.extraHosts = opt.extraHosts;
        this.writeStreams = opt.writeStreams;
        this.jobNamePad = opt.namePad;
        this.name = opt.name;
        this.cwd = opt.cwd;
        this.jobId = opt.id;
        this.jobData = opt.data;
        this.pipelineIid = opt.pipelineIid;

        this.when = jobData.when || "on_success";
        this.allowFailure = jobData.allow_failure != null ? jobData.allow_failure == "true" : false;
        this.needs = jobData.needs || null;
        this.dependencies = jobData.dependencies || null;
        this.rules = jobData.rules || null;
        this.environment = typeof jobData.environment === "string" ? {name: jobData.environment} : jobData.environment;
        this.cache = jobData.cache || null;

        const predefinedVariables = {
            GITLAB_USER_LOGIN: gitUser["GITLAB_USER_LOGIN"],
            GITLAB_USER_EMAIL: gitUser["GITLAB_USER_EMAIL"],
            GITLAB_USER_NAME: gitUser["GITLAB_USER_NAME"],
            CI_COMMIT_SHORT_SHA: "a33bd89c", // Changes
            CI_COMMIT_SHA: "a33bd89c7b8fa3567524525308d8cafd7c0cd2ad",
            CI_PROJECT_DIR: this.imageName ? "/builds/" : `${this.cwd}`,
            CI_PROJECT_NAME: gitRemote.project,
            CI_PROJECT_TITLE: `${camelCase(gitRemote.project)}`,
            CI_PROJECT_PATH: `${gitRemote.group}/${camelCase(gitRemote.project)}`,
            CI_PROJECT_PATH_SLUG: `${gitRemote.group.replace(/\//g, "-")}-${gitRemote.project}`,
            CI_PROJECT_NAMESPACE: `${gitRemote.group}`,
            CI_COMMIT_REF_PROTECTED: "false",
            CI_COMMIT_BRANCH: "local/branch", // Branch name, only when building branches
            CI_COMMIT_REF_NAME: "local/branch", // Tag or branch name
            CI_PROJECT_VISIBILITY: "internal",
            CI_PROJECT_ID: "1217",
            CI_COMMIT_REF_SLUG: "local-branch",
            CI_COMMIT_TITLE: "Commit Title", // First line of commit message.
            CI_COMMIT_MESSAGE: "Commit Title\nMore commit text", // Full commit message
            CI_COMMIT_DESCRIPTION: "More commit text",
            CI_PIPELINE_SOURCE: "push",
            CI_JOB_ID: `${this.jobId}`, // Changes on rerun
            CI_PIPELINE_ID: `${this.pipelineIid + 1000}`,
            CI_PIPELINE_IID: `${this.pipelineIid}`,
            CI_SERVER_HOST: `${gitRemote.domain}`,
            CI_SERVER_URL: `https://${gitRemote.domain}:443`,
            CI_API_V4_URL: `https://${gitRemote.domain}/api/v4`,
            CI_PROJECT_URL: `https://${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}`,
            CI_JOB_URL: `https://${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}/-/jobs/${this.jobId}`, // Changes on rerun.
            CI_PIPELINE_URL: `https://${gitRemote.domain}/${gitRemote.group}/${gitRemote.project}/pipelines/${this.pipelineIid}`,
            CI_JOB_NAME: `${this.name}`,
            CI_JOB_STAGE: `${this.stage}`,
            GITLAB_CI: "false",
        };

        // Create expanded variables
        const envs = {...globals.variables || {}, ...jobData.variables || {}, ...predefinedVariables, ...process.env};
        const expandedGlobalVariables = Utils.expandVariables(globals.variables || {}, envs);
        const expandedJobVariables = Utils.expandVariables(jobData.variables || {}, envs);

        this.expandedVariables = {...expandedGlobalVariables, ...expandedJobVariables, ...homeVariables, ...predefinedVariables};

        // Set {when, allowFailure} based on rules result
        if (this.rules) {
            const ruleResult = Utils.getRulesResult(this.rules, this.expandedVariables);
            this.when = ruleResult.when;
            this.allowFailure = ruleResult.allowFailure;
        }

        if (this.interactive && (this.when !== "manual" || this.imageName !== null)) {
            throw new ExitError(`${this.chalkJobName} @Interactive decorator cannot have image: and must be when:manual`);
        }

        if (this.injectSSHAgent && this.imageName === null) {
            throw new ExitError(`${this.chalkJobName} @InjectSSHAgent can only be used with image:`);
        }
    }

    get chalkJobName() {
        return chalk`{blueBright ${this.name.padEnd(this.jobNamePad)}}`;
    }

    get safeJobName() {
        const emojiRegex = /\uD83C\uDFF4\uDB40\uDC67\uDB40\uDC62(?:\uDB40\uDC77\uDB40\uDC6C\uDB40\uDC73|\uDB40\uDC73\uDB40\uDC63\uDB40\uDC74|\uDB40\uDC65\uDB40\uDC6E\uDB40\uDC67)\uDB40\uDC7F|(?:\uD83E\uDDD1\uD83C\uDFFF\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFF\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFE])|(?:\uD83E\uDDD1\uD83C\uDFFE\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFE\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFD\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFD\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFC\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFC\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|(?:\uD83E\uDDD1\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83E\uDDD1|\uD83D\uDC69\uD83C\uDFFB\u200D\uD83E\uDD1D\u200D(?:\uD83D[\uDC68\uDC69]))(?:\uD83C[\uDFFC-\uDFFF])|\uD83D\uDC68(?:\uD83C\uDFFB(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFC-\uDFFF])|[\u2695\u2696\u2708]\uFE0F|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))?|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFF]))|\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D)?\uD83D\uDC68|(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFE])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB-\uDFFD\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFC\uDFFE\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83E\uDD1D\u200D\uD83D\uDC68(?:\uD83C[\uDFFB\uDFFD-\uDFFF])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])\uFE0F|\u200D(?:(?:\uD83D[\uDC68\uDC69])\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D[\uDC66\uDC67])|\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC)?|(?:\uD83D\uDC69(?:\uD83C\uDFFB\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|(?:\uD83C[\uDFFC-\uDFFF])\u200D\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69]))|\uD83E\uDDD1(?:\uD83C[\uDFFB-\uDFFF])\u200D\uD83E\uDD1D\u200D\uD83E\uDDD1)(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67]))|\uD83D\uDC69(?:\u200D(?:\u2764\uFE0F\u200D(?:\uD83D\uDC8B\u200D(?:\uD83D[\uDC68\uDC69])|\uD83D[\uDC68\uDC69])|\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83E\uDDD1(?:\u200D(?:\uD83E\uDD1D\u200D\uD83E\uDDD1|\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFF\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFE\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFD\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFC\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD])|\uD83C\uDFFB\u200D(?:\uD83C[\uDF3E\uDF73\uDF7C\uDF84\uDF93\uDFA4\uDFA8\uDFEB\uDFED]|\uD83D[\uDCBB\uDCBC\uDD27\uDD2C\uDE80\uDE92]|\uD83E[\uDDAF-\uDDB3\uDDBC\uDDBD]))|\uD83D\uDC69\u200D\uD83D\uDC66\u200D\uD83D\uDC66|\uD83D\uDC69\u200D\uD83D\uDC69\u200D(?:\uD83D[\uDC66\uDC67])|\uD83D\uDC69\u200D\uD83D\uDC67\u200D(?:\uD83D[\uDC66\uDC67])|(?:\uD83D\uDC41\uFE0F\u200D\uD83D\uDDE8|\uD83E\uDDD1(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDC69(?:\uD83C\uDFFF\u200D[\u2695\u2696\u2708]|\uD83C\uDFFE\u200D[\u2695\u2696\u2708]|\uD83C\uDFFD\u200D[\u2695\u2696\u2708]|\uD83C\uDFFC\u200D[\u2695\u2696\u2708]|\uD83C\uDFFB\u200D[\u2695\u2696\u2708]|\u200D[\u2695\u2696\u2708])|\uD83D\uDE36\u200D\uD83C\uDF2B|\uD83C\uDFF3\uFE0F\u200D\u26A7|\uD83D\uDC3B\u200D\u2744|(?:(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF])\u200D[\u2640\u2642]|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])\u200D[\u2640\u2642]|\uD83C\uDFF4\u200D\u2620|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])\u200D[\u2640\u2642]|[\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u2328\u23CF\u23ED-\u23EF\u23F1\u23F2\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB\u25FC\u2600-\u2604\u260E\u2611\u2618\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u2692\u2694-\u2697\u2699\u269B\u269C\u26A0\u26A7\u26B0\u26B1\u26C8\u26CF\u26D1\u26D3\u26E9\u26F0\u26F1\u26F4\u26F7\u26F8\u2702\u2708\u2709\u270F\u2712\u2714\u2716\u271D\u2721\u2733\u2734\u2744\u2747\u2763\u27A1\u2934\u2935\u2B05-\u2B07\u3030\u303D\u3297\u3299]|\uD83C[\uDD70\uDD71\uDD7E\uDD7F\uDE02\uDE37\uDF21\uDF24-\uDF2C\uDF36\uDF7D\uDF96\uDF97\uDF99-\uDF9B\uDF9E\uDF9F\uDFCD\uDFCE\uDFD4-\uDFDF\uDFF5\uDFF7]|\uD83D[\uDC3F\uDCFD\uDD49\uDD4A\uDD6F\uDD70\uDD73\uDD76-\uDD79\uDD87\uDD8A-\uDD8D\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA\uDECB\uDECD-\uDECF\uDEE0-\uDEE5\uDEE9\uDEF0\uDEF3])\uFE0F|\uD83C\uDFF3\uFE0F\u200D\uD83C\uDF08|\uD83D\uDC69\u200D\uD83D\uDC67|\uD83D\uDC69\u200D\uD83D\uDC66|\uD83D\uDE35\u200D\uD83D\uDCAB|\uD83D\uDE2E\u200D\uD83D\uDCA8|\uD83D\uDC15\u200D\uD83E\uDDBA|\uD83E\uDDD1(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83D\uDC69(?:\uD83C\uDFFF|\uD83C\uDFFE|\uD83C\uDFFD|\uD83C\uDFFC|\uD83C\uDFFB)?|\uD83C\uDDFD\uD83C\uDDF0|\uD83C\uDDF6\uD83C\uDDE6|\uD83C\uDDF4\uD83C\uDDF2|\uD83D\uDC08\u200D\u2B1B|\u2764\uFE0F\u200D(?:\uD83D\uDD25|\uD83E\uDE79)|\uD83D\uDC41\uFE0F|\uD83C\uDFF3\uFE0F|\uD83C\uDDFF(?:\uD83C[\uDDE6\uDDF2\uDDFC])|\uD83C\uDDFE(?:\uD83C[\uDDEA\uDDF9])|\uD83C\uDDFC(?:\uD83C[\uDDEB\uDDF8])|\uD83C\uDDFB(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDEE\uDDF3\uDDFA])|\uD83C\uDDFA(?:\uD83C[\uDDE6\uDDEC\uDDF2\uDDF3\uDDF8\uDDFE\uDDFF])|\uD83C\uDDF9(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDED\uDDEF-\uDDF4\uDDF7\uDDF9\uDDFB\uDDFC\uDDFF])|\uD83C\uDDF8(?:\uD83C[\uDDE6-\uDDEA\uDDEC-\uDDF4\uDDF7-\uDDF9\uDDFB\uDDFD-\uDDFF])|\uD83C\uDDF7(?:\uD83C[\uDDEA\uDDF4\uDDF8\uDDFA\uDDFC])|\uD83C\uDDF5(?:\uD83C[\uDDE6\uDDEA-\uDDED\uDDF0-\uDDF3\uDDF7-\uDDF9\uDDFC\uDDFE])|\uD83C\uDDF3(?:\uD83C[\uDDE6\uDDE8\uDDEA-\uDDEC\uDDEE\uDDF1\uDDF4\uDDF5\uDDF7\uDDFA\uDDFF])|\uD83C\uDDF2(?:\uD83C[\uDDE6\uDDE8-\uDDED\uDDF0-\uDDFF])|\uD83C\uDDF1(?:\uD83C[\uDDE6-\uDDE8\uDDEE\uDDF0\uDDF7-\uDDFB\uDDFE])|\uD83C\uDDF0(?:\uD83C[\uDDEA\uDDEC-\uDDEE\uDDF2\uDDF3\uDDF5\uDDF7\uDDFC\uDDFE\uDDFF])|\uD83C\uDDEF(?:\uD83C[\uDDEA\uDDF2\uDDF4\uDDF5])|\uD83C\uDDEE(?:\uD83C[\uDDE8-\uDDEA\uDDF1-\uDDF4\uDDF6-\uDDF9])|\uD83C\uDDED(?:\uD83C[\uDDF0\uDDF2\uDDF3\uDDF7\uDDF9\uDDFA])|\uD83C\uDDEC(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEE\uDDF1-\uDDF3\uDDF5-\uDDFA\uDDFC\uDDFE])|\uD83C\uDDEB(?:\uD83C[\uDDEE-\uDDF0\uDDF2\uDDF4\uDDF7])|\uD83C\uDDEA(?:\uD83C[\uDDE6\uDDE8\uDDEA\uDDEC\uDDED\uDDF7-\uDDFA])|\uD83C\uDDE9(?:\uD83C[\uDDEA\uDDEC\uDDEF\uDDF0\uDDF2\uDDF4\uDDFF])|\uD83C\uDDE8(?:\uD83C[\uDDE6\uDDE8\uDDE9\uDDEB-\uDDEE\uDDF0-\uDDF5\uDDF7\uDDFA-\uDDFF])|\uD83C\uDDE7(?:\uD83C[\uDDE6\uDDE7\uDDE9-\uDDEF\uDDF1-\uDDF4\uDDF6-\uDDF9\uDDFB\uDDFC\uDDFE\uDDFF])|\uD83C\uDDE6(?:\uD83C[\uDDE8-\uDDEC\uDDEE\uDDF1\uDDF2\uDDF4\uDDF6-\uDDFA\uDDFC\uDDFD\uDDFF])|[#\\*0-9]\uFE0F\u20E3|\u2764\uFE0F|(?:\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD])(?:\uD83C[\uDFFB-\uDFFF])|(?:\u26F9|\uD83C[\uDFCB\uDFCC]|\uD83D\uDD75)(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|\uD83C\uDFF4|(?:[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5])(?:\uD83C[\uDFFB-\uDFFF])|(?:[\u261D\u270C\u270D]|\uD83D[\uDD74\uDD90])(?:\uFE0F|\uD83C[\uDFFB-\uDFFF])|[\u270A\u270B]|\uD83C[\uDF85\uDFC2\uDFC7]|\uD83D[\uDC08\uDC15\uDC3B\uDC42\uDC43\uDC46-\uDC50\uDC66\uDC67\uDC6B-\uDC6D\uDC72\uDC74-\uDC76\uDC78\uDC7C\uDC83\uDC85\uDC8F\uDC91\uDCAA\uDD7A\uDD95\uDD96\uDE2E\uDE35\uDE36\uDE4C\uDE4F\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1C\uDD1E\uDD1F\uDD30-\uDD34\uDD36\uDD77\uDDB5\uDDB6\uDDBB\uDDD2\uDDD3\uDDD5]|\uD83C[\uDFC3\uDFC4\uDFCA]|\uD83D[\uDC6E\uDC70\uDC71\uDC73\uDC77\uDC81\uDC82\uDC86\uDC87\uDE45-\uDE47\uDE4B\uDE4D\uDE4E\uDEA3\uDEB4-\uDEB6]|\uD83E[\uDD26\uDD35\uDD37-\uDD39\uDD3D\uDD3E\uDDB8\uDDB9\uDDCD-\uDDCF\uDDD4\uDDD6-\uDDDD]|\uD83D\uDC6F|\uD83E[\uDD3C\uDDDE\uDDDF]|[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF84\uDF86-\uDF93\uDFA0-\uDFC1\uDFC5\uDFC6\uDFC8\uDFC9\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC07\uDC09-\uDC14\uDC16-\uDC3A\uDC3C-\uDC3E\uDC40\uDC44\uDC45\uDC51-\uDC65\uDC6A\uDC79-\uDC7B\uDC7D-\uDC80\uDC84\uDC88-\uDC8E\uDC90\uDC92-\uDCA9\uDCAB-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDDA4\uDDFB-\uDE2D\uDE2F-\uDE34\uDE37-\uDE44\uDE48-\uDE4A\uDE80-\uDEA2\uDEA4-\uDEB3\uDEB7-\uDEBF\uDEC1-\uDEC5\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0D\uDD0E\uDD10-\uDD17\uDD1D\uDD20-\uDD25\uDD27-\uDD2F\uDD3A\uDD3F-\uDD45\uDD47-\uDD76\uDD78\uDD7A-\uDDB4\uDDB7\uDDBA\uDDBC-\uDDCB\uDDD0\uDDE0-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6]|(?:[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55]|\uD83C[\uDC04\uDCCF\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE1A\uDE2F\uDE32-\uDE36\uDE38-\uDE3A\uDE50\uDE51\uDF00-\uDF20\uDF2D-\uDF35\uDF37-\uDF7C\uDF7E-\uDF93\uDFA0-\uDFCA\uDFCF-\uDFD3\uDFE0-\uDFF0\uDFF4\uDFF8-\uDFFF]|\uD83D[\uDC00-\uDC3E\uDC40\uDC42-\uDCFC\uDCFF-\uDD3D\uDD4B-\uDD4E\uDD50-\uDD67\uDD7A\uDD95\uDD96\uDDA4\uDDFB-\uDE4F\uDE80-\uDEC5\uDECC\uDED0-\uDED2\uDED5-\uDED7\uDEEB\uDEEC\uDEF4-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])|(?:[#\\*0-9\xA9\xAE\u203C\u2049\u2122\u2139\u2194-\u2199\u21A9\u21AA\u231A\u231B\u2328\u23CF\u23E9-\u23F3\u23F8-\u23FA\u24C2\u25AA\u25AB\u25B6\u25C0\u25FB-\u25FE\u2600-\u2604\u260E\u2611\u2614\u2615\u2618\u261D\u2620\u2622\u2623\u2626\u262A\u262E\u262F\u2638-\u263A\u2640\u2642\u2648-\u2653\u265F\u2660\u2663\u2665\u2666\u2668\u267B\u267E\u267F\u2692-\u2697\u2699\u269B\u269C\u26A0\u26A1\u26A7\u26AA\u26AB\u26B0\u26B1\u26BD\u26BE\u26C4\u26C5\u26C8\u26CE\u26CF\u26D1\u26D3\u26D4\u26E9\u26EA\u26F0-\u26F5\u26F7-\u26FA\u26FD\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2721\u2728\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2755\u2757\u2763\u2764\u2795-\u2797\u27A1\u27B0\u27BF\u2934\u2935\u2B05-\u2B07\u2B1B\u2B1C\u2B50\u2B55\u3030\u303D\u3297\u3299]|\uD83C[\uDC04\uDCCF\uDD70\uDD71\uDD7E\uDD7F\uDD8E\uDD91-\uDD9A\uDDE6-\uDDFF\uDE01\uDE02\uDE1A\uDE2F\uDE32-\uDE3A\uDE50\uDE51\uDF00-\uDF21\uDF24-\uDF93\uDF96\uDF97\uDF99-\uDF9B\uDF9E-\uDFF0\uDFF3-\uDFF5\uDFF7-\uDFFF]|\uD83D[\uDC00-\uDCFD\uDCFF-\uDD3D\uDD49-\uDD4E\uDD50-\uDD67\uDD6F\uDD70\uDD73-\uDD7A\uDD87\uDD8A-\uDD8D\uDD90\uDD95\uDD96\uDDA4\uDDA5\uDDA8\uDDB1\uDDB2\uDDBC\uDDC2-\uDDC4\uDDD1-\uDDD3\uDDDC-\uDDDE\uDDE1\uDDE3\uDDE8\uDDEF\uDDF3\uDDFA-\uDE4F\uDE80-\uDEC5\uDECB-\uDED2\uDED5-\uDED7\uDEE0-\uDEE5\uDEE9\uDEEB\uDEEC\uDEF0\uDEF3-\uDEFC\uDFE0-\uDFEB]|\uD83E[\uDD0C-\uDD3A\uDD3C-\uDD45\uDD47-\uDD78\uDD7A-\uDDCB\uDDCD-\uDDFF\uDE70-\uDE74\uDE78-\uDE7A\uDE80-\uDE86\uDE90-\uDEA8\uDEB0-\uDEB6\uDEC0-\uDEC2\uDED0-\uDED6])\uFE0F|(?:[\u261D\u26F9\u270A-\u270D]|\uD83C[\uDF85\uDFC2-\uDFC4\uDFC7\uDFCA-\uDFCC]|\uD83D[\uDC42\uDC43\uDC46-\uDC50\uDC66-\uDC78\uDC7C\uDC81-\uDC83\uDC85-\uDC87\uDC8F\uDC91\uDCAA\uDD74\uDD75\uDD7A\uDD90\uDD95\uDD96\uDE45-\uDE47\uDE4B-\uDE4F\uDEA3\uDEB4-\uDEB6\uDEC0\uDECC]|\uD83E[\uDD0C\uDD0F\uDD18-\uDD1F\uDD26\uDD30-\uDD39\uDD3C-\uDD3E\uDD77\uDDB5\uDDB6\uDDB8\uDDB9\uDDBB\uDDCD-\uDDCF\uDDD1-\uDDDD])/g;
        return this.name.replace(/ /g, "_").replace(emojiRegex, "_");
    }

    get imageName(): string | null {
        const image = this.jobData["image"];
        if (!image) {
            return null;
        }

        const imageName = Utils.expandText(image.name, this.expandedVariables);
        return imageName.includes(":") ? imageName : `${imageName}:latest`;
    }

    get imageEntrypoint(): string[] | null {
        const image = this.jobData["image"];
        if (!image) {
            return null;
        }
        if (typeof image.entrypoint !== "object") {
            throw new ExitError("image:entrypoint must be an array");
        }
        return image.entrypoint;
    }

    get stage(): string {
        return this.jobData["stage"] || "test";
    }

    get interactive(): boolean {
        return this.jobData["interactive"] || false;
    }

    get injectSSHAgent(): boolean {
        return this.jobData["injectSSHAgent"] || false;
    }

    get description(): string {
        return this.jobData["description"] ?? "";
    }

    get artifacts(): { paths: string[] } {
        return this.jobData["artifacts"] || {paths: []};
    }

    get beforeScripts(): string[] {
        return this.jobData["before_script"] || [];
    }

    get afterScripts(): string[] {
        return this.jobData["after_script"] || [];
    }

    get scripts(): string[] {
        return this.jobData["script"];
    }

    get preScriptsExitCode() {
        return this._prescriptsExitCode;
    }

    get afterScriptsExitCode() {
        return this._afterScriptsExitCode;
    }

    get running() {
        return this._running;
    }

    get started() {
        return this._running || this._prescriptsExitCode !== null;
    }

    get finished() {
        return !this._running && this._prescriptsExitCode !== null;
    }

    get coveragePercent(): string | null {
        return this._coveragePercent;
    }

    async start(privileged: boolean): Promise<void> {
        const startTime = process.hrtime();
        const writeStreams = this.writeStreams;

        this._running = true;
        this.refreshLongRunningSilentTimeout(writeStreams);

        await fs.ensureFile(`${this.cwd}/.gitlab-ci-local/output/${this.name}.log`);
        await fs.truncate(`${this.cwd}/.gitlab-ci-local/output/${this.name}.log`);

        if (!this.imageName) {
            const {hrdeltatime} = await Utils.rsyncNonIgnoredFilesToBuilds(this.cwd, this.name);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright rsynced to build folder} in {magenta ${prettyHrtime(hrdeltatime)}}\n`);
        }

        if (!this.interactive) {
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright starting} ${this.imageName ?? "shell"} ({yellow ${this.stage}})\n`);
        }

        const prescripts = this.beforeScripts.concat(this.scripts);
        this._prescriptsExitCode = await this.execScripts(prescripts, privileged);
        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && !this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
            await this.cleanupResources();
            this._running = false;
            return;
        }

        if (this.afterScripts.length === 0 && this._prescriptsExitCode > 0 && this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
            await this.cleanupResources();
            this._running = false;
            return;
        }

        if (this._prescriptsExitCode > 0 && this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, true)}\n`);
        }

        if (this._prescriptsExitCode > 0 && !this.allowFailure) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._prescriptsExitCode, false)}\n`);
        }

        if (this.afterScripts.length > 0) {
            this._afterScriptsExitCode = await this.execScripts(this.afterScripts, privileged);
        }

        if (this._afterScriptsExitCode > 0) {
            writeStreams.stderr(`${this.getExitedString(startTime, this._afterScriptsExitCode, true, " after_script")}\n`);
        }

        writeStreams.stdout(`${this.getFinishedString(startTime)}\n`);

        if (this.jobData.coverage) {
            this._coveragePercent = await Utils.getCoveragePercent(this.cwd, this.jobData.coverage, this.name);
        }

        await this.cleanupResources();
        this._running = false;
    }

    public async cleanupResources() {
        const writeStreams = this.writeStreams;
        clearTimeout(this._longRunningSilentTimeout);

        if (this._containerId) {
            try {
                await Utils.spawn(`docker rm -f ${this._containerId}`);
            } catch (e) {
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._artifactsContainerId) {
            try {
                await Utils.spawn(`docker rm -f ${this._artifactsContainerId}`);
            } catch(e) {
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }

        if (this._containerVolumeName) {
            try {
                await Utils.spawn(`docker volume rm ${this._containerVolumeName}`);
            } catch (e) {
                writeStreams.stderr(chalk`{yellow ${e.message}}`);
            }
        }
    }

    private generateInjectSSHAgentOptions() {
        if (!this.injectSSHAgent) {
            return "";
        }
        if (process.env.OSTYPE === "darwin") {
            return "--env SSH_AUTH_SOCK=/run/host-services/ssh-auth.sock -v /run/host-services/ssh-auth.sock:/run/host-services/ssh-auth.sock";
        }
        return `--env SSH_AUTH_SOCK=${process.env.SSH_AUTH_SOCK} -v ${process.env.SSH_AUTH_SOCK}:${process.env.SSH_AUTH_SOCK}`;
    }

    private generateScriptCommands(scripts: string[]) {
        let cmd = "";
        scripts.forEach((script) => {
            // Print command echo'ed in color
            const split = script.split(/\r?\n/);
            const multilineText = split.length > 1 ? " # collapsed multi-line command" : "";
            const text = split[0]?.replace(/["]/g, "\\\"").replace(/[$]/g, "\\$");
            cmd += chalk`echo "{green $ ${text}${multilineText}}"\n`;

            // Execute actual script
            cmd += `${script}\n`;
        });
        return cmd;
    }

    private async execScripts(scripts: string[], privileged: boolean): Promise<number> {
        const outputFilesPath = `${this.cwd}/.gitlab-ci-local/output/${this.name}.log`;
        const writeStreams = this.writeStreams;
        const artifactsFrom = this.needs || this.dependencies;
        let time;
        let endTime;

        if (scripts.length === 0 || scripts[0] == null) {
            return 0;
        }

        if (this.interactive) {
            let iCmd = "";
            for (const [key, value] of Object.entries(this.expandedVariables)) {
                iCmd += `export ${key}="${String(value).trim()}"\n`;
            }
            iCmd += this.generateScriptCommands(scripts);

            const cp = childProcess.spawn(iCmd, {
                shell: "bash",
                stdio: ["inherit", "inherit", "inherit"],
                cwd: this.cwd,
            });
            return new Promise<number>((resolve, reject) => {
                cp.on("exit", (code) => resolve(code ?? 0));
                cp.on("error", (err) => reject(err));
            });
        }

        if (this.imageName) {
            time = process.hrtime();
            let pullCmd = "";
            pullCmd += `docker image ls --format '{{.Repository}}:{{.Tag}}' | grep -E '^${this.imageName}$'\n`;
            pullCmd += "if [ \"$?\" -ne 0 ]; then\n";
            pullCmd += `\techo "Pulling ${this.imageName}"\n`;
            pullCmd += `\tdocker pull ${this.imageName}\n`;
            pullCmd += "fi\n";
            await Utils.spawn(pullCmd, this.cwd);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright pulled} ${this.imageName} in {magenta ${prettyHrtime(endTime)}}\n`);

            let dockerCmd = "";
            if (privileged) {
                dockerCmd += `docker create --privileged -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            } else {
                dockerCmd += `docker create -u 0:0 -i ${this.generateInjectSSHAgentOptions()} `;
            }

            this._containerVolumeName = `gcl-${this.safeJobName}-${this.jobId}`;
            await Utils.spawn(`docker volume create ${this._containerVolumeName}`, this.cwd);
            dockerCmd += `--volume ${this._containerVolumeName}:/builds/ `;

            for (const extraHost of this.extraHosts) {
                dockerCmd += `--add-host=${extraHost} `;
            }

            if (this.imageEntrypoint) {
                this.imageEntrypoint.forEach((e) => {
                    dockerCmd += `--entrypoint "${e}" `;
                });
            }

            for (const [key, value] of Object.entries(this.expandedVariables)) {
                dockerCmd += `-e ${key}="${String(value).trim()}" `;
            }

            if (this.cache && this.cache.key && typeof this.cache.key === "string" && this.cache.paths) {
                this.cache.paths.forEach((path) => {
                    writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright mounting cache} for path ${path}\n`);
                    // /tmp/ location instead of .gitlab-ci-local/cache avoids the (unneeded) inclusion of cache folders when docker copy all files into the container, thus saving time for all jobs
                    dockerCmd += `-v /tmp/gitlab-ci-local/cache/${this.cache.key}/${path}:/builds/${path} `;
                });
            }

            dockerCmd += `${this.imageName} sh -c "\n`;
            dockerCmd += "if [ -x /usr/local/bin/bash ]; then\n";
            dockerCmd += "\texec /usr/local/bin/bash \n";
            dockerCmd += "elif [ -x /usr/bin/bash ]; then\n";
            dockerCmd += "\texec /usr/bin/bash \n";
            dockerCmd += "elif [ -x /bin/bash ]; then\n";
            dockerCmd += "\texec /bin/bash \n";
            dockerCmd += "elif [ -x /usr/local/bin/sh ]; then\n";
            dockerCmd += "\texec /usr/local/bin/sh \n";
            dockerCmd += "elif [ -x /usr/bin/sh ]; then\n";
            dockerCmd += "\texec /usr/bin/sh \n";
            dockerCmd += "elif [ -x /bin/sh ]; then\n";
            dockerCmd += "\texec /bin/sh \n";
            dockerCmd += "elif [ -x /busybox/sh ]; then\n";
            dockerCmd += "\texec /busybox/sh \n";
            dockerCmd += "else\n";
            dockerCmd += "\techo shell not found\n";
            dockerCmd += "\texit 1\n";
            dockerCmd += "fi\n\"";

            const {stdout: containerId} = await Utils.spawn(dockerCmd, this.cwd, {...process.env, ...this.expandedVariables});
            this._containerId = containerId.replace(/\r?\n/g, "");

            time = process.hrtime();
            await Utils.spawn(`docker cp .gitlab-ci-local/builds/.docker/. ${this._containerId}:/builds/`, this.cwd);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied source to container} in {magenta ${prettyHrtime(endTime)}}\n`);

            if (artifactsFrom === null || artifactsFrom.length > 0) {
                time = process.hrtime();
                await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/`);
                await Utils.spawn(`docker cp ${this.cwd}/.gitlab-ci-local/artifacts/. ${this._containerId}:/builds/`);
                endTime = process.hrtime(time);
                writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to container} in {magenta ${prettyHrtime(endTime)}}\n`);
            }

            await Utils.spawn(`docker run --rm -w /builds/ -v ${this._containerVolumeName}:/builds/ debian:stable-slim bash -c "chown root:root -R . && chmod a=rw -R ."`);
        }

        if (this.imageName === null && (artifactsFrom === null || artifactsFrom.length > 0)) {
            time = process.hrtime();
            await fs.mkdirp(`${this.cwd}/.gitlab-ci-local/artifacts/`);
            await Utils.spawn(`rsync -a ${this.cwd}/.gitlab-ci-local/artifacts/. ${this.cwd}`);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright copied artifacts to cwd} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        let cmd = "set -eo pipefail\n";
        cmd += "exec 0< /dev/null\n";

        if (this.imageName) {
            cmd += "cd /builds/\n";
        } else {
            for (const [key, value] of Object.entries(this.expandedVariables)) {
                cmd += `export ${key}="${String(value).trim()}"\n`;
            }
        }

        cmd += this.generateScriptCommands(scripts);

        cmd += "exit 0\n";

        await fs.outputFile(`${this.cwd}/.gitlab-ci-local/scripts/${this.safeJobName}`, cmd, "utf-8");
        await fs.chmod(`${this.cwd}/.gitlab-ci-local/scripts/${this.safeJobName}`, "0755");

        if (this.imageName) {
            await Utils.spawn(`docker cp .gitlab-ci-local/scripts/. ${this._containerId}:/gcl-scripts/`, this.cwd);
        }

        const cp = childProcess.spawn(this._containerId ? `docker start --attach -i ${this._containerId}` : "bash", {
            shell: "bash",
            stdio: ["pipe", "pipe", "pipe"],
            cwd: this.cwd,
        });

        const outFunc = (e: any, stream: (txt: string) => void, colorize: (str: string) => string) => {
            this.refreshLongRunningSilentTimeout(writeStreams);
            for (const line of `${e}`.split(/\r?\n/)) {
                if (line.length === 0) {
                    continue;
                }

                stream(`${this.chalkJobName} `);
                if (!line.startsWith("\u001b[32m$")) {
                    stream(`${colorize(">")} `);
                }
                stream(`${line}\n`);
                fs.appendFileSync(outputFilesPath, `${line}\n`);
            }
        };

        const exitCode = await new Promise<number>((resolve, reject) => {
            cp.stdout.on("data", (e) => outFunc(e, writeStreams.stdout.bind(writeStreams), (s) => chalk`{greenBright ${s}}`));
            cp.stderr.on("data", (e) => outFunc(e, writeStreams.stderr.bind(writeStreams), (s) => chalk`{redBright ${s}}`));

            cp.on("exit", (code) => setTimeout(() => resolve(code ?? 0), 10));
            cp.on("error", (err) => setTimeout(() => reject(err), 10));

            if (this.imageName) {
                cp.stdin.end(`/gcl-scripts/${this.safeJobName}`);
            } else {
                cp.stdin.end(`./.gitlab-ci-local/scripts/${this.safeJobName}`);
            }
        });

        if (this.imageName && this.artifacts.paths.length > 0) {
            let cpCmd = "shopt -s globstar\nmkdir -p /artifacts/\n";
            for (const artifactPath of this.artifacts.paths) {
                const expandedPath = Utils.expandText(artifactPath, this.expandedVariables);
                cpCmd += `echo Started copying ${expandedPath} to /artifacts\n`;
                cpCmd += "cd /builds/\n";
                cpCmd += `cp -r --parents ${expandedPath} /artifacts\n`;
                cpCmd += `echo Done copying ${expandedPath} to /artifacts\n`;
            }

            time = process.hrtime();
            const {stdout: artifactsContainerId} = await Utils.spawn(`docker create -i -v ${this._containerVolumeName}:/builds/ debian:stable-slim bash -c "${cpCmd}"`, this.cwd);
            this._artifactsContainerId = artifactsContainerId.replace(/\r?\n/g, "");
            await Utils.spawn(`docker start ${this._artifactsContainerId} --attach`);
            await Utils.spawn(`docker cp ${this._artifactsContainerId}:/artifacts .gitlab-ci-local/.`, this.cwd);
            endTime = process.hrtime(time);
            writeStreams.stdout(chalk`${this.chalkJobName} {magentaBright saved artifacts} in {magenta ${prettyHrtime(endTime)}}\n`);
        }

        return exitCode;
    }

    private refreshLongRunningSilentTimeout(writeStreams: WriteStreams) {
        clearTimeout(this._longRunningSilentTimeout);
        this._longRunningSilentTimeout = setTimeout(() => {
            writeStreams.stdout(chalk`${this.chalkJobName} {grey > still running...}\n`);
        }, 10000);
    }

    private getExitedString(startTime: [number, number], code: number, warning = false, prependString = "") {
        const finishedStr = this.getFinishedString(startTime);
        if (warning) {
            return chalk`${finishedStr} {black.bgYellowBright  WARN ${code.toString()} }${prependString}`;
        }

        return chalk`${finishedStr} {black.bgRed  FAIL ${code.toString()} } ${prependString}`;
    }

    private getFinishedString(startTime: [number, number]) {
        const endTime = process.hrtime(startTime);
        const timeStr = prettyHrtime(endTime);
        return chalk`${this.chalkJobName} {magentaBright finished} in {magenta ${timeStr}}`;
    }
}
