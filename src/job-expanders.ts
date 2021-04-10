import * as chalk from "chalk";
import * as deepExtend from "deep-extend";
import {Job} from "./job";
import {ExitError} from "./types/exit-error";
import {Utils} from "./utils";
import {assert} from "./asserts";

export function jobExtends(gitlabData: any) {
    for (const jobName of Object.keys(gitlabData)) {
        if (Job.illegalJobNames.includes(jobName) || jobName[0] === ".") {
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
            assert(parentData != null, chalk`{blueBright ${parentName}} is extended from {blueBright ${jobName}}, but is unspecified`);
            if (jobData.extends.length === 0) {
                delete jobData.extends;
            }

            if (parentData.extends) {
                jobData.extends = (jobData.extends || []).concat(parentData.extends);
            }

            gitlabData[jobName] = deepExtend({}, parentData, jobData);
        }

        assert(i < maxDepth, chalk`You have an infinite extends loop starting from {blueBright ${jobName}}`);
    }
}

export function reference(gitlabData: any, recurseData: any) {
    for (const [key, value] of Object.entries<any>(recurseData || {})) {
        if (value && value.referenceData) {
            recurseData[key] = getSubDataByReference(gitlabData, value.referenceData);
        } else if (typeof value === 'object') {
            reference(gitlabData, value);
        }
    }
}

const getSubDataByReference = (gitlabData: any, referenceData: string[]) => {
    let gitlabSubData = gitlabData;
    referenceData.forEach((referencePointer) => {
        gitlabSubData = gitlabSubData[referencePointer];
    });
    return gitlabSubData;
};

export function artifacts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedArtifacts = jobData.artifacts || (gitlabData.default || {}).artifacts || gitlabData.artifacts;
        if (expandedArtifacts) {
            jobData.artifacts = expandedArtifacts;
        }
    });
}

export function image(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedImage = jobData.image || (gitlabData.default || {}).image || gitlabData.image;
        if (expandedImage) {
            jobData.image = {
                name: typeof expandedImage === 'string' ? expandedImage : expandedImage.name,
                entrypoint: typeof expandedImage === 'string' ? null : expandedImage.entrypoint,
            }
        }
    });
}

const expandMultidimension = (inputArr: any) => {
    const arr = [];
    for (const line of inputArr) {
        if (typeof line == "string") {
            arr.push(line);
        } else {
            line.forEach((l: string) => arr.push(l));
        }
    }
    return arr;
};

export function beforeScripts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedBeforeScripts = [].concat(jobData.before_script || (gitlabData.default || {}).before_script || gitlabData.before_script || []);
        if (expandedBeforeScripts.length > 0) {
            jobData.before_script = expandMultidimension(expandedBeforeScripts);
        }
    });
}

export function afterScripts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedAfterScripts = [].concat(jobData.after_script || (gitlabData.default || {}).after_script || gitlabData.after_script || []);
        if (expandedAfterScripts.length > 0) {
            jobData.after_script = expandMultidimension(expandedAfterScripts);
        }
    });
}

export function scripts(gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
        if (!jobData.script && !jobData.trigger) {
            throw new ExitError(chalk`{blueBright ${jobName}} must have script specified`);
        }
        jobData.script = typeof jobData.script === "string" ? [jobData.script] : jobData.script;
        if (jobData.script) {
            jobData.script = expandMultidimension(jobData.script);
        }
    });
}
