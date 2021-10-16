import {Utils} from "./utils";
import {Job} from "./job";

export class Producers {

    static init(jobs: ReadonlyMap<string, Job>, stages: readonly string[], job: Job) {
        const producerSet: Set<string> = new Set();

        if (job.needs && job.needs.length === 0) return [];
        if (!job.needs && !job.dependencies) {
            Utils.getJobNamesFromPreviousStages(jobs, stages, job).forEach(jobName => producerSet.add(jobName));
        }
        (job.dependencies ?? []).forEach(dependency => {
            const foundInNeeds = (job.needs ?? []).find(n => n.job === dependency);
            if (foundInNeeds) return;
            producerSet.add(dependency);
        });
        (job.needs ?? []).forEach(need => {
            if (!need.artifacts) return;
            producerSet.add(need.job);
        });

        let producers: string[] = Array.from(producerSet);
        producers = producers.filter((producerName) => {
            const producerJob = jobs.get(producerName);
            return producerJob && producerJob.artifacts && producerJob.when != "never";
        });

        return producers.map(producerName => {
            const producerJob = jobs.get(producerName);
            return {name: producerName, dotenv: producerJob?.artifacts?.reports?.dotenv ?? null};
        });
    }

}
