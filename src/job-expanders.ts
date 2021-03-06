import {blueBright} from "ansi-colors";
import * as deepExtend from "deep-extend";
import {Job} from "./job";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";
import {assert} from "./asserts";

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
            assert(parentData != null, `${blueBright(parentName)} is extended from ${blueBright(jobName)}, but is unspecified`);
            if (jobData.extends.length === 0) {
                delete jobData.extends;
            }

            gitlabData[jobName] = deepExtend({}, parentData, jobData);
        }

        assert(i < maxDepth, `You have an infinite extends loop starting from ${blueBright(jobName)}`);
    }
}

export function artifacts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedArtifacts = jobData.artifacts || (gitlabData.default || {}).artifacts || gitlabData.artifacts;
        if (expandedArtifacts) {
            jobData.artifacts = expandedArtifacts;
        }
    });
}

export function image(gitlabData: any, envs: { [key: string]: string }) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedImage = jobData.image || (gitlabData.default || {}).image || gitlabData.image;
        if (expandedImage) {
            jobData.image = Utils.expandText(expandedImage, envs);
        }
    });
}

export function beforeScripts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedBeforeScripts = [].concat(jobData.before_script || (gitlabData.default || {}).before_script || gitlabData.before_script || []);
        if (expandedBeforeScripts.length > 0) {
            jobData.before_script = expandedBeforeScripts;
        }
    });
}

export function afterScripts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedAfterScripts = [].concat(jobData.after_script || (gitlabData.default || {}).after_script || gitlabData.after_script || []);
        if (expandedAfterScripts.length > 0) {
            jobData.after_script = expandedAfterScripts;
        }
    });
}

export function scripts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
        if (!jobData.script && !jobData.trigger) {
            throw new ExitError(`${blueBright(jobName)} must have script specified`);
        }
        jobData.script = typeof jobData.script === "string" ? [jobData.script] : jobData.script;
        jobData.script = jobData.script ?? [];
    });
}
