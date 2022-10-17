import chalk from "chalk";
import deepExtend from "deep-extend";
import {Utils} from "./utils";
import {assert} from "./asserts";
import {Job} from "./job";
import {Service} from "./service";
import {traverse} from "object-traversal";
import {CacheEntry} from "./cache-entry";
import {ExitError} from "./exit-error";

const extendsMaxDepth = 11;
const extendsRecurse = (gitlabData: any, jobName: string, jobData: any, parents: any[], depth: number) => {
    assert(depth < extendsMaxDepth, chalk`{blueBright ${jobName}}: circular dependency detected in \`extends\``);
    depth++;
    for (const parentName of (jobData.extends || [])) {
        const parentData = gitlabData[parentName];
        assert(parentData != null, chalk`{blueBright ${parentName}} is extended from {blueBright ${jobName}}, but is unspecified`);
        extendsRecurse(gitlabData, parentName, parentData, parents, depth);
        parents.push(parentData);
    }
    return parents;
};

export function globalVariables (gitlabData: any) {
    for (const [key, value] of Object.entries<any>(gitlabData.variables ?? {})) {
        if (typeof value == "object") {
            gitlabData.variables[key] = value["value"];
        }
    }
}

export function jobExtends (gitlabData: any) {
    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.includes(jobName)) continue;
        if (typeof jobData != "object") continue;
        jobData.extends = typeof jobData.extends === "string" ? [jobData.extends] : jobData.extends ?? [];
    }

    Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
        const parentDatas = extendsRecurse(gitlabData, jobName, jobData, [], 0);
        gitlabData[jobName] = deepExtend({}, ...parentDatas, jobData);
    });

    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.includes(jobName)) continue;
        if (typeof jobData != "object") continue;
        delete jobData.extends;
    }
}

export function reference (gitlabData: any, recurseData: any) {
    for (const [key, value] of Object.entries<any>(recurseData || {})) {
        if (value && value.referenceData) {
            recurseData[key] = getSubDataByReference(gitlabData, value.referenceData);
        } else if (typeof value === "object") {
            reference(gitlabData, value);
        }

        if (hasCircularChain(recurseData)) {
            throw new ExitError(`!reference circular chain detected [${value.referenceData}]`);
        }
    }
}

const getSubDataByReference = (gitlabData: any, referenceData: string[]) => {
    let gitlabSubData = gitlabData;
    referenceData.forEach((referencePointer) => {
        assert(gitlabSubData[referencePointer] != null, `!reference [${referenceData.join(", ")}] is undefined`);
        gitlabSubData = gitlabSubData[referencePointer];
    });
    return gitlabSubData;
};

function hasCircularChain (data: any) {
    try {
        JSON.stringify(data);
    } catch (e) {
        if (e instanceof TypeError && e.message.startsWith("Converting circular structure to JSON")) {
            return true;
        }
    }
    return false;
}

export function artifacts (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedArtifacts = jobData.artifacts || (gitlabData.default || {}).artifacts || gitlabData.artifacts;
        if (expandedArtifacts) {
            jobData.artifacts = expandedArtifacts;
        }
    });
}

export function cache (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const mergedCache = jobData.cache || (gitlabData.default || {}).cache || gitlabData.cache;
        if (mergedCache) {
            const cacheList: CacheEntry[] = [];
            (Array.isArray(mergedCache) ? mergedCache : [mergedCache]).forEach((c: any) => {
                const key = c["key"];
                const policy = c["policy"] ?? "pull-push";
                if (!["pull", "push", "pull-push"].includes(policy)) {
                    throw new ExitError("cache policy is not 'pull', 'push' or 'pull-push'");
                }
                const paths = c["paths"] ?? [];
                cacheList.push(new CacheEntry(key, paths, policy));
            });
            jobData.cache = cacheList;
        }
    });
}

export function services (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedServices = jobData.services || (gitlabData.default || {}).services || gitlabData.services;
        if (expandedServices) {
            jobData.services = [];
            for (const [index, expandedService] of Object.entries<any>(expandedServices)) {
                jobData.services[index] = new Service({
                    name: typeof expandedService === "string" ? expandedService : expandedService.name,
                    entrypoint: expandedService.entrypoint,
                    command: expandedService.command,
                    alias: expandedService.alias,
                }, Number(index));
            }
        }
    });
}

export function image (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedImage = jobData.image || (gitlabData.default || {}).image || gitlabData.image;
        if (expandedImage) {
            jobData.image = {
                name: typeof expandedImage === "string" ? expandedImage : expandedImage.name,
                entrypoint: expandedImage.entrypoint,
            };
        }
    });
}

export function beforeScripts (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedBeforeScripts = [].concat(jobData.before_script || (gitlabData.default || {}).before_script || gitlabData.before_script || []);
        if (expandedBeforeScripts.length > 0) {
            jobData.before_script = expandedBeforeScripts;
        }
    });
}

export function afterScripts (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedAfterScripts = [].concat(jobData.after_script || (gitlabData.default || {}).after_script || gitlabData.after_script || []);
        if (expandedAfterScripts.length > 0) {
            jobData.after_script = expandedAfterScripts;
        }
    });
}

export function scripts (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (jobName, jobData) => {
        assert(jobData.script || jobData.trigger, chalk`{blueBright ${jobName}} must have script specified`);
        jobData.script = typeof jobData.script === "string" ? [jobData.script] : jobData.script;
    });
}

export function flattenLists (gitlabData: any) {
    traverse(gitlabData, ({parent, key, value}) => {
        if (!Array.isArray(value) || parent == null || typeof key != "string") return;
        parent[key] = value.flat(5);
    });
}
