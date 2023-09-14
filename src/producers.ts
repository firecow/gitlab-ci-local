import {Utils} from "./utils";
import {Job} from "./job";
import assert from "assert";
import chalk from "chalk";

export class Producers {

    static init (jobs: ReadonlyArray<Job>, stages: readonly string[], job: Job) {
        const producerSet: Set<string> = new Set();

        if (job.needs && job.needs.length === 0) return [];
        if (!job.needs && !job.dependencies) {
            for (const jobName of Utils.getJobNamesFromPreviousStages(jobs, stages, job)) {
                producerSet.add(jobName);
            }
        }
        (job.dependencies ?? []).forEach(dependency => {
            const foundInNeeds = (job.needs ?? []).find(n => n.job === dependency);
            if (foundInNeeds) return;
            producerSet.add(dependency);
        });
        (job.needs ?? []).forEach(need => {
            if (!need.artifacts) return;
            if (need.pipeline) return;
            if (need.project) return;
            producerSet.add(need.job);
        });

        const producers: Job[] = [];

        for (const potential of jobs) {
            if (potential.artifacts == null) continue;
            if (potential.when == "never") continue;
            if (!producerSet.has(potential.name) && !producerSet.has(potential.baseName)) continue;
            producers.push(potential);
        }

        if (job.needs) {
            for (const need of job.needs) {
                const matrix = need.parallel?.matrix;
                const toRemove = [];
                for (const p of producers) {
                    assert(p.matrixVariables, chalk`{blueBright ${job.name}} use needs.parallel.matrix towards {blueBright ${p.baseName}} that doesn't implement it`);
                    for (const m of matrix ?? []) {
                        if (!Utils.objectShallowEqual(p.matrixVariables, m)) {
                            toRemove.push(p);
                        }
                    }
                }
                for (const t of toRemove) {
                    producers.splice(producers.indexOf(t), 1);
                }
            }
        }

        return producers.map(producer => {
            return {name: producer.name, dotenv: producer?.artifacts?.reports?.dotenv ?? null};
        });
    }

}
