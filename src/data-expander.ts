import chalk from "chalk";
import deepExtend from "deep-extend";
import {Utils} from "./utils";
import assert, {AssertionError} from "assert";
import {Job} from "./job";
import {traverse} from "object-traversal";

const extendsMaxDepth = 11;
const extendsRecurse = (gitlabData: any, jobName: string, jobData: any, parents: any[], depth: number) => {
    assert(depth < extendsMaxDepth, chalk`{blueBright ${jobName}}: circular dependency detected in \`extends\``);
    depth++;
    for (const parentName of (jobData.extends || [])) {
        const parentData = gitlabData[parentName];
        assert(parentData != null, chalk`{blueBright ${parentName}} is unspecified, used by {blueBright ${jobName}} extends`);
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
        if (Object.getPrototypeOf(jobData) !== Object.prototype) continue;
        jobData.extends = typeof jobData.extends === "string" ? [jobData.extends] : jobData.extends ?? [];
        const parentDatas = extendsRecurse(gitlabData, jobName, jobData, [], 0);
        gitlabData[jobName] = deepExtend({}, ...parentDatas, jobData);
    }

    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.includes(jobName)) continue;
        if (Object.getPrototypeOf(jobData) !== Object.prototype) continue;
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
            throw new AssertionError({message: `!reference circular chain detected [${value.referenceData}]`});
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

export function complexObjects (gitlabData: any) {
    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.includes(jobName)) continue;
        if (typeof jobData === "string") continue;
        needs(jobName, gitlabData);
        artifacts(jobName, gitlabData);
        cache(jobName, gitlabData);
        services(jobName, gitlabData);
        image(jobName, gitlabData);
    }
}

export function needs (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    if (!jobData.needs) return;

    for (const [i, need] of Object.entries<any>(jobData.needs)) {
        if (need.referenceData) continue;
        jobData.needs[i] = {
            job: need.job ?? need,
            artifacts: need.artifacts ?? true,
            optional: need.optional ?? false,
            pipeline: need.pipeline ?? null,
            project: need.project ?? null,
        };
    }
}

export function artifacts (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    jobData.artifacts = jobData.artifacts ?? gitlabData.default?.artifacts ?? gitlabData.artifacts;
}

export function cache (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    jobData.cache = jobData.cache ?? gitlabData.default?.cache ?? gitlabData.cache;
    if (!jobData.cache) return;
    jobData.cache = Array.isArray(jobData.cache) ? jobData.cache : [jobData.cache];

    for (const [i, c] of Object.entries<any>(jobData.cache)) {
        if (c.referenceData) continue;
        jobData.cache[i] = {
            key: c.key,
            paths: c.paths ?? [],
            policy: c.policy ?? "pull-push",
            when: c.when ?? "on_success",
        };
    }
}

export function services (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    jobData.services = jobData.services ?? gitlabData.default?.services ?? gitlabData.services;
    if (!jobData.services) return;

    for (const [index, s] of Object.entries<any>(jobData.services)) {
        if (s.referenceData) continue;
        jobData.services[index] = {
            name: typeof s === "string" ? s : s.name,
            entrypoint: s.entrypoint,
            command: s.command,
            alias: s.alias,
        };
    }
}

export function image (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    jobData.image = jobData.image ?? gitlabData.default?.image ?? gitlabData.image;
    if (!jobData.image) return;

    jobData.image = {
        name: typeof jobData.image === "string" ? jobData.image : jobData.image.name,
        entrypoint: jobData.image.entrypoint,
    };
}

export function beforeScripts (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedBeforeScripts = [].concat(jobData.before_script ?? gitlabData.default?.before_script ?? gitlabData.before_script ?? []);
        if (expandedBeforeScripts.length > 0) {
            jobData.before_script = expandedBeforeScripts;
        }
    });
}

export function afterScripts (gitlabData: any) {
    Utils.forEachRealJob(gitlabData, (_, jobData) => {
        const expandedAfterScripts = [].concat(jobData.after_script ?? gitlabData.default?.after_script ?? gitlabData.after_script ?? []);
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
