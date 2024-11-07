import {Job} from "./job";


export type MultiJobRunnerOptions = {
    concurrency: number;
};

/**
 * Run multiple jobs in parallel, if a job is interactive it will no be run in parallel.
 *
 * @param jobs the rubs to run in parallel
 * @param options parallelization options
 */
export async function runMultipleJobs (jobs: Job[], options: MultiJobRunnerOptions): Promise<void> {
    const activeJobsById: Map<number, Promise<void>> = new Map();

    for (const job of jobs) {
        if (job.interactive) {
            await Promise.all(activeJobsById.values());
            await job.start();
            continue;
        }

        if (activeJobsById.size >= options.concurrency) {
            await Promise.any(activeJobsById.values());
        }

        const execution = job.start();
        activeJobsById.set(job.jobId, execution);
        execution.then(() => {
            activeJobsById.delete(job.jobId);
        });
        continue;

    }

    await Promise.all(activeJobsById.values());
}
