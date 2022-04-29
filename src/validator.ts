import {Job} from "./job";
import {assert} from "./asserts";
import chalk from "chalk";
import {Utils} from "./utils";

export class Validator {

    private static needs(jobs: ReadonlyMap<string, Job>, stages: readonly string[]) {
        const jobNames = [...jobs.values()].map((j) => j.name);
        for (const [jobName, job] of jobs) {
            if (job.needs === null || job.needs.length === 0) continue;

            const undefNeed = job.needs.filter((v) => !jobNames.some(n => n === v.job));
            const assertMsg = chalk`[ {blueBright ${undefNeed.map(n => n.job).join(",")}} ] jobs are needed by {blueBright ${jobName}}, but they cannot be found`;
            assert(undefNeed.length !== job.needs.length, assertMsg);

            for (const need of job.needs) {
                const needJob = Utils.getJobByName(jobs, need.job);
                const needJobStageIndex = stages.indexOf(needJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                const assertMsg = chalk`{blueBright ${needJob.name}} is needed by {blueBright ${job.name}}, but it is in a future stage`;
                assert(needJobStageIndex <= jobStageIndex, assertMsg);
            }

        }
    }

    private static dependenciesContainment(jobs: ReadonlyMap<string, Job>) {
        for (const job of jobs.values()) {
            const needs = job.needs;
            const dependencies = job.dependencies;
            if (needs && needs.length === 0) continue;
            if (!dependencies || !needs) continue;


            const everyIncluded = dependencies.every((dep: string) => {
                return needs.some(n => n.job === dep);
            });
            const assertMsg = `${job.chalkJobName} needs: '${needs.map(n => n.job).join(",")}' doesn't fully contain dependencies: '${dependencies.join(",")}'`;
            assert(everyIncluded, assertMsg);
        }
    }

    private static scriptBlank(jobs: ReadonlyMap<string, Job>) {
        for (const [jobName, job] of jobs) {
            if (job.trigger) continue; // Jobs with trigger are allowed to have empty script
            assert(job.scripts.length > 0, chalk`{blue ${jobName}} has empty script`);
        }
    }

    static async run(jobs: ReadonlyMap<string, Job>, stages: readonly string[]) {
        this.scriptBlank(jobs);
        this.needs(jobs, stages);
        this.dependenciesContainment(jobs);
    }
}
