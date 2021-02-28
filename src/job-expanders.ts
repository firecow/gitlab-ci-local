import {blueBright} from "ansi-colors";
import * as deepExtend from "deep-extend";
import {Job} from "./job";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";

export function jobExtends(gitlabData: any) {
    for (const jobName of Object.keys(gitlabData)) {
        if (Job.illigalJobNames.includes(jobName) || jobName[0] === ".") {
            continue;
        }

        let i = 0;
        const maxDepth = 50;
        for (i; i < maxDepth; i++) {
            const jobData = gitlabData[jobName];
            jobData.extends = typeof jobData.extends === "string" ? [jobData.extends] : jobData.extends ?? [];
            if (gitlabData[jobName].extends.length === 0) {
                delete jobData.extends;
                break;
            }

            const parentName = jobData.extends.pop();
            const parentData = gitlabData[parentName];
            if (!parentData) {
                throw new ExitError(`${blueBright(parentName)} is extended from ${blueBright(jobName)}, but is unspecified`);
            }
            if (jobData.extends.length === 0) {
                delete jobData.extends;
            }

            gitlabData[jobName] = deepExtend({}, parentData, jobData);
        }
        if (i === maxDepth) {
            throw new ExitError(`You have an infinite extends loop starting from ${blueBright(jobName)}`);
        }
    }
}

export function artifacts(gitlabData: any) {
    forEachRealJob(gitlabData, (_, jobData) => {
        const expandedArtifacts = jobData.artifacts || (gitlabData.default || {}).artifacts || gitlabData.artifacts;
        if (expandedArtifacts) {
            jobData.artifacts = expandedArtifacts;
        }
    });
}

export function image(gitlabData: any, envs: { [key: string]: string }) {
    forEachRealJob(gitlabData, (_, jobData) => {
        const expandedImage = jobData.image || (gitlabData.default || {}).image || gitlabData.image;
        if (expandedImage) {
            jobData.image = Utils.expandText(expandedImage, envs);
        }
    });
}

export function beforeScripts(gitlabData: any) {
    forEachRealJob(gitlabData, (_, jobData) => {
        const expandedBeforeScripts = [].concat(jobData.before_script || (gitlabData.default || {}).before_script || gitlabData.before_script || []);
        if (expandedBeforeScripts.length > 0) {
            jobData.before_script = expandedBeforeScripts;
        }
    });
}

export function afterScripts(gitlabData: any) {
    forEachRealJob(gitlabData, (_, jobData) => {
        const expandedAfterScripts = [].concat(jobData.after_script || (gitlabData.default || {}).after_script || gitlabData.after_script || []);
        if (expandedAfterScripts.length > 0) {
            jobData.after_script = expandedAfterScripts;
        }
    });
}

export function scripts(gitlabData: any) {
    forEachRealJob(gitlabData, (jobName, jobData) => {
        if (!jobData.script) {
            throw new ExitError(`${blueBright(jobName)} must have script specified`);
        }
        jobData.script = typeof jobData.script === "string" ? [jobData.script] : jobData.script;
    });
}

export function forEachRealJob(gitlabData: any, callback: (jobName: string, jobData: any) => void) {
    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illigalJobNames.includes(jobName) || jobName[0] === ".") {
            continue;
        }
        callback(jobName, jobData);
    }
}
