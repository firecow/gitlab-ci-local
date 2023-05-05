import {Job} from "./job";
import assert from "assert";
import chalk from "chalk";

export class Validator {

    private static needs (jobs: ReadonlyArray<Job>, stages: readonly string[]): string[] {
        const warnings: string[] = [];
        for (const job of jobs) {
            if (job.needs === null || job.needs.length === 0) continue;

            for (const need of job.needs) {
                if (need.pipeline) {
                    warnings.push(`${job.name} WARNING: Ignoring needs.job '${need.job}' because of unsupported needs.pipeline`);
                    continue;
                }
                const needJob = jobs.find(j => j.baseName === need.job);
                if (need.optional && !needJob) continue;
                assert(needJob != null, chalk`needs: [{blueBright ${need.job}}] for {blueBright ${job.baseName}} could not be found`);
                const needJobStageIndex = stages.indexOf(needJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(needJobStageIndex <= jobStageIndex, chalk`needs: [{blueBright ${needJob.name}}] for {blueBright ${job.name}} is in a future stage`);
            }

        }
        return warnings;
    }

    private static dependencies (jobs: ReadonlyArray<Job>, stages: readonly string[]) {
        for (const job of jobs) {
            if (job.dependencies === null || job.dependencies.length === 0) continue;

            const undefDeps = job.dependencies.filter((j) => !jobs.some(n => n.baseName === j));
            assert(undefDeps.length !== job.dependencies.length, chalk`dependencies: [{blueBright ${undefDeps.join(",")}}] for {blueBright ${job.name}} cannot be found`);

            for (const dep of job.dependencies) {
                const depJob = jobs.find(j => j.baseName === dep);
                assert(depJob != null, chalk`dependencies: [{blueBright ${dep}}] for {blueBright ${job.baseName}} could not be found`);
                const depJobStageIndex = stages.indexOf(depJob.stage);
                const jobStageIndex = stages.indexOf(job.stage);
                assert(depJobStageIndex <= jobStageIndex, chalk`dependencies: [{blueBright ${depJob.name}}] for {blueBright ${job.name}} is in a future stage`);
            }
        }
    }

    private static dependenciesContainment (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            const needs = job.needs;
            const dependencies = job.dependencies;
            if (needs && needs.length === 0) continue;
            if (!dependencies || !needs) continue;


            const everyIncluded = dependencies.every((dep: string) => {
                return needs.some(n => n.job === dep);
            });
            const assertMsg = `${job.formattedJobName} needs: '${needs.map(n => n.job).join(",")}' doesn't fully contain dependencies: '${dependencies.join(",")}'`;
            assert(everyIncluded, assertMsg);
        }
    }

    private static scriptBlank (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            if (job.trigger) continue; // Jobs with trigger are allowed to have empty script
            assert(job.scripts.length > 0, chalk`{blue ${job.name}} has empty script`);
        }
    }

    private static arrayOfStrings (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            if (job.trigger) continue;
            job.beforeScripts.forEach((s: any) => assert(typeof s === "string", chalk`{blue ${job.name}} before_script contains non string value`));
            job.afterScripts.forEach((s: any) => assert(typeof s === "string", chalk`{blue ${job.name}} after_script contains non string value`));
            job.scripts.forEach((s: any) => assert(typeof s === "string", chalk`{blue ${job.name}} script contains non string value`));
        }
    }

    private static cache (jobs: ReadonlyArray<Job>) {
        for (const job of jobs) {
            job.cache.forEach((c, i) => {
                assert(Array.isArray(c.paths), chalk`{blue ${job.name}} cache[${i}].paths must be array`);
            });
        }
    }

    static async run (jobs: ReadonlyArray<Job>, stages: readonly string[]) {
        const warnings: string[] = [];
        this.scriptBlank(jobs);
        this.arrayOfStrings(jobs);
        warnings.push(...this.needs(jobs, stages));
        this.dependencies(jobs, stages);
        this.cache(jobs);
        this.dependenciesContainment(jobs);
        return warnings;
    }
}
