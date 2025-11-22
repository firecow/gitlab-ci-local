import chalk from "chalk";
import deepExtend from "deep-extend";
import assert, {AssertionError} from "assert";
import {Job, Need} from "./job.js";
import {traverse} from "object-traversal";
import {Utils} from "./utils.js";

const extendsMaxDepth = 11;
const extendsRecurse = (gitlabData: any, jobName: string, jobData: any, parents: any[], depth: number) => {
    assert(depth < extendsMaxDepth, chalk`{blueBright ${jobName}}: circular dependency detected in \`extends\``);
    depth++;

    jobData.extends = typeof jobData.extends === "string" ? [jobData.extends] : jobData.extends;
    jobData.extends = jobData.extends ?? [];

    for (const parentName of jobData.extends) {
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
        if (!Utils.isObject(jobData)) continue;
        const parentDatas = extendsRecurse(gitlabData, jobName, jobData, [], 0);
        gitlabData[jobName] = deepExtend({}, ...parentDatas, jobData);
    }

    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.has(jobName)) continue;
        if (!Utils.isObject(jobData)) continue;
        delete jobData.extends;
    }
}

export function reference (gitlabData: any, recurseData: any) {
    for (const [key, value] of Object.entries<any>(recurseData || {})) {
        if (value?.referenceData) {
            if (Object.keys(value).length > 1) {
                recurseData[key] = {...getSubDataByReference(gitlabData, value.referenceData), ...recurseData[key]};
                delete recurseData[key].referenceData;
            } else {
                recurseData[key] = getSubDataByReference(gitlabData, value.referenceData);
            }
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

/**
  Transform the globally defined ["image", "services", "cache", "before_script", "after_script"] into the default.x syntax
  https://docs.gitlab.com/ee/ci/yaml/index.html#globally-defined-image-services-cache-before_script-after_script
*/
export function transformDeprecatedGlobalDefaultSyntax (gitlabData: any) {
    const GITLAB_DEPRECATED_GLOBALLY_DEFINED_KEYWORDS = ["image", "services", "cache", "before_script", "after_script"];

    gitlabData.default = gitlabData.default ?? {};
    for (const g of GITLAB_DEPRECATED_GLOBALLY_DEFINED_KEYWORDS) {
        if (gitlabData[g] !== undefined) {
            gitlabData.default[g] = gitlabData[g];
            delete gitlabData[g]; // Since this is deprecated, deleting it to prevent us from using it internally
        }
    }
}

export function normalize (gitlabData: any) {
    normalizeGlobalVariables(gitlabData);

    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (Job.illegalJobNames.has(jobName) || jobName.startsWith(".")) continue;
        needsEach(jobName, gitlabData);
        cacheEach(jobName, gitlabData);
        servicesEach(jobName, gitlabData);
        imageEach(jobName, gitlabData);

        jobData.after_script = (typeof jobData.after_script === "string" && jobData.after_script !== "") ? [jobData.after_script] : jobData.after_script;
        jobData.before_script = (typeof jobData.before_script === "string" && jobData.before_script !== "") ? [jobData.before_script] : jobData.before_script;
        jobData.script = (typeof jobData.script === "string" && jobData.script !== "") ? [jobData.script] : jobData.script;
    }
}

export function needsComplex (data: any) {
    const needs: Need = {
        job: data.job ?? data,
        artifacts: data.artifacts ?? true,
        ...(data.pipeline ? {pipeline: data.pipeline} : {}),
        ...(data.project ? {project: data.project} : {}),
        ...(data.ref ? {ref: data.ref} : {}),
        ...(data.optional ? {optional: data.optional} : {}),
    };

    // In needs:project/needs:pipeline, `optional` is not an allowed property
    if (!data.project && !data.pipeline && data.optional === undefined) {
        needs.optional = false;
    }
    return needs;
}

export function needsEach (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    if (!jobData.needs) return;

    for (const [i, n] of Object.entries<any>(jobData.needs)) {
        jobData.needs[i] = needsComplex(n);
    }
}

export function cacheComplex (data: any) {
    return {
        key: data.key,
        paths: data.paths,
        policy: data.policy ?? "pull-push",
        when: data.when ?? "on_success",
    };
}

export function cacheEach (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    const cache = jobData.cache;
    if (!cache) return;

    jobData.cache = Array.isArray(cache) ? cache : [cache];
    for (const [i, c] of Object.entries<any>(jobData.cache)) {
        if (c.key?.files instanceof Array) {
            assert(c.key.files.length === 1 || c.key.files.length === 2, `cache:key:files should be an array of one or two file paths. Got ${c.key.files.length}`);
        }
        jobData.cache[i] = cacheComplex(c);
    }

    // Remove cache elements with empty paths array (gitlab.com works the same way.)
    jobData.cache = jobData.cache.filter((c: any) => c.paths?.length !== undefined);
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

export function servicesEach (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    const services = jobData.services;
    if (!services) return;

    jobData.services = Array.isArray(services) ? services : [services];

    for (const [i, s] of Object.entries<any>(jobData.services)) {
        jobData.services[i] = servicesComplex(s);
    }
}

export function imageComplex (data: any) {
    if (data == null) return data;
    return {
        name: typeof data === "string" ? data : data.name,
        entrypoint: data.entrypoint,
        ...(data.docker?.user ? {docker: {user: data.docker?.user}} : {}),
    };
}

export function imageEach (jobName: string, gitlabData: any) {
    const jobData = gitlabData[jobName];
    const image = jobData.image;
    if (!image) return;

    jobData.image = imageComplex(jobData.image);
}

export function inheritDefault (gitlabData: any) {
    for (const [jobName, jobData] of Object.entries<any>(gitlabData)) {
        if (jobData.inherit?.default === false) continue;

        if (Job.illegalJobNames.has(jobName) || jobName.startsWith(".")) {
            // skip hidden jobs as they might just contain shared yaml
            // see https://github.com/firecow/gitlab-ci-local/issues/1277
            continue;
        }

        const keywordsToInheritFrom = (Array.isArray(jobData.inherit?.default)) ?
            jobData.inherit.default :
            ["artifacts", "cache", "services", "image", "before_script", "after_script"];

        for (const keyword of keywordsToInheritFrom) {
            if (gitlabData.default[keyword] !== undefined) jobData[keyword] = jobData[keyword] ?? gitlabData.default[keyword];
        }
    }
}

function normalizeGlobalVariables (gitlabData: any) {
    for (const [key, value] of Object.entries<any>(gitlabData.variables ?? {})) {
        gitlabData.variables[key] = Utils.normalizeVariables(value);
    }
}

export function flattenLists (gitlabData: any) {
    traverse(gitlabData, ({parent, key, value, meta}) => {
        if (parent != null && key != null && Array.isArray(value)) {
            assert(!value.flat(9).some(Array.isArray), chalk`This Gitlab CI configuration is invalid: {blueBright ${meta.nodePath}} config should be string or a nested array of strings up to 10 level deep`);
        }
    }, {cycleHandling: true});

    traverse(gitlabData, ({parent, key, value}) => {
        if (parent != null && key != null && Array.isArray(value)) {
            parent[key] = value.flat(9);
        }
    }, {cycleHandling: false});
}
