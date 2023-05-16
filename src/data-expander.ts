import chalk from "chalk";
import deepExtend from "deep-extend";
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

export function jobExtends (gitlabData: any) {
    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.has(jobName)) continue;
        if (Object.getPrototypeOf(jobData) !== Object.prototype) continue;
        jobData.extends = typeof jobData.extends === "string" ? [jobData.extends] : jobData.extends ?? [];
        const parentDatas = extendsRecurse(gitlabData, jobName, jobData, [], 0);
        gitlabData[jobName] = deepExtend({}, ...parentDatas, jobData);
    }

    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.has(jobName)) continue;
        if (Object.getPrototypeOf(jobData) !== Object.prototype) continue;
        delete jobData.extends;
    }
}

export function reference (gitlabData: any, recurseData: any) {
    for (const [key, value] of Object.entries<any>(recurseData || {})) {
        if (value?.referenceData) {
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
        if (Job.illegalJobNames.has(jobName)) continue;
        if (typeof jobData === "string") continue;
        needs(jobName, gitlabData);
        cache(jobName, gitlabData);
        services(jobName, gitlabData);
        image(jobName, gitlabData);
        if (jobData.script) jobData.script = typeof jobData.script === "string" ? [jobData.script] : jobData.script;
    }
}

export function needsComplex (data: any) {
    return {
        job: data.job ?? data,
        artifacts: data.artifacts ?? true,
        optional: data.optional ?? false,
        pipeline: data.pipeline ?? null,
        project: data.project ?? null,
    };
}

export function cacheComplex (data: any) {
    return {
        key: data.key,
        paths: data.paths,
        policy: data.policy ?? "pull-push",
        when: data.when ?? "on_success",
    };
}

export function servicesComplex (data: any) {
    return {
        name: typeof data === "string" ? data : data.name,
        entrypoint: data.entrypoint,
        command: data.command,
        alias: data.alias,
        variables: data.variables,
    };
}

export function imageComplex (data: any) {
    if (data == null) return data;
    return {
        name: typeof data === "string" ? data : data.name,
        entrypoint: data.entrypoint,
    };
}

export function globalVariables (gitlabData: any) {
    for (const [key, value] of Object.entries<any>(gitlabData.variables ?? {})) {
        if (typeof value == "object" && !Array.isArray(value)) {
            gitlabData.variables[key] = value["value"];
        }
    }
}

export function needs (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    if (!jobData.needs) return;

    reference(gitlabData, jobData.needs);
    jobData.needs = jobData.needs.flat(5);
    for (const [i, n] of Object.entries<any>(jobData.needs)) {
        jobData.needs[i] = needsComplex(n);
    }
}

export function cache (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    const cache = jobData.cache;
    if (!cache) return;

    jobData.cache = Array.isArray(cache) ? cache : [cache];
    reference(gitlabData, jobData.cache);
    jobData.cache = jobData.cache.flat(5);
    for (const [i, c] of Object.entries<any>(jobData.cache)) {
        jobData.cache[i] = cacheComplex(c);
    }
}

export function services (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    const services = jobData.services;
    if (!services) return;

    reference(gitlabData, jobData.services);
    jobData.services = jobData.services.flat(5);
    jobData.services = services;

    for (const [i, s] of Object.entries<any>(jobData.services)) {
        jobData.services[i] = servicesComplex(s);
    }
}

export function image (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    const image = jobData.image;
    if (!image) return;

    reference(gitlabData, jobData.image);
    jobData.image = imageComplex(jobData.image);
}

export function defaults (gitlabData: any) {
    const cacheData = gitlabData.default?.cache ?? gitlabData.cache;
    let cache = null;
    if (cacheData) {
        cache = [];
        for (const c of Array.isArray(cacheData) ? cacheData : [cacheData]) {
            cache.push(cacheComplex(c));
        }
    }

    const serviceData = gitlabData.default?.services ?? gitlabData.services;
    let services = null;
    if (serviceData) {
        services = [];
        for (const s of serviceData) {
            services.push(servicesComplex(s));
        }
    }

    const image = imageComplex(gitlabData.default?.image ?? gitlabData.image);
    const artifacts = gitlabData.default?.artifacts ?? gitlabData.artifacts;
    const beforeScript = gitlabData.default?.before_script ?? gitlabData.before_script;
    const afterScript = gitlabData.default?.after_script ?? gitlabData.after_script;

    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.has(jobName)) continue;
        if (typeof jobData === "string") continue;
        if (!jobData.artifacts && artifacts) jobData.artifacts = artifacts;
        if (!jobData.cache && cache) jobData.cache = cache;
        if (!jobData.services && services) jobData.services = services;
        if (!jobData.image && image) jobData.image = image;
        if (!jobData.after_script && afterScript) jobData.after_script = afterScript;
        if (!jobData.before_script && beforeScript) jobData.before_script = beforeScript;
    }
}

export function flattenLists (gitlabData: any) {
    traverse(gitlabData, ({parent, key, value}) => {
        if (!Array.isArray(value) || parent == null || typeof key != "string") return;
        parent[key] = value.flat(5);
    });
}
