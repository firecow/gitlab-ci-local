import {Utils} from "./utils";
import {Job} from "./job";

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
        return producers.map(producer => {
            return {name: producer.name, dotenv: producer?.artifacts?.reports?.dotenv ?? null};
        });
    }

}
