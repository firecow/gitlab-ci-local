import {Job} from "./job";

export class JobExecutor {

    static async runLoop(jobs: ReadonlyMap<string, Job>, stages: readonly string[], potentialStarters: Job[], privileged: boolean) {
        let runningJobs = [];
        let startCandidates = [];

        do {
            startCandidates = JobExecutor.getStartCandidates(jobs, stages, potentialStarters);
            startCandidates.forEach(j => j.start(privileged).then());
            runningJobs = JobExecutor.getRunning(jobs);
            await new Promise<void>((resolve) => { setTimeout(() => { resolve(); }, 5); });
        } while (runningJobs.length > 0);
    }

    static getStartCandidates(jobs: ReadonlyMap<string, Job>, stages: readonly string[], potentialStarters: readonly Job[]) {
        const startCandidates = [];
        for (const job of potentialStarters) {
            if (!job.started && !JobExecutor.isPastFailed(jobs, stages, job) && !JobExecutor.isWaitingForPast(jobs, stages, job)) {
                startCandidates.push(job);
            }
        }
        return startCandidates;
    }

    static isPastFailed(jobs: ReadonlyMap<string, Job>, stages: readonly string[], job: Job) {
        const jobsToWaitFor = JobExecutor.getPastToWaitFor(jobs, stages, job);
        const failJobs = jobsToWaitFor.filter(j => {
            if (j.allowFailure) {
                return false;
            }
            return (j.preScriptsExitCode ? j.preScriptsExitCode : 0) > 0;
        });
        return failJobs.length > 0;
    }

    static isWaitingForPast(jobs: ReadonlyMap<string, Job>, stages: readonly string[], job: Job) {
        const jobsToWaitFor = JobExecutor.getPastToWaitFor(jobs, stages, job);
        const notFinishedJobs = jobsToWaitFor.filter(j => !j.finished);
        return notFinishedJobs.length > 0;
    }

    static getPastToWaitFor(jobs: ReadonlyMap<string, Job>, stages: readonly string[], job: Job) {
        let jobsToWaitFor: Job[] = [];
        if (job.needs) {
            job.needs.forEach(needJob => {
                const found = jobs.get(needJob);
                if (found) {
                    jobsToWaitFor.push(found);
                }
            });
        } else {
            const stageIndex = stages.indexOf(job.stage);
            const pastStages = stages.slice(0, stageIndex);
            pastStages.forEach((pastStage) => {
                jobsToWaitFor = [...jobs.values()].filter(j => j.stage === pastStage);
            });
        }
        return jobsToWaitFor;
    }

    static getRunning(jobs: ReadonlyMap<string, Job>) {
        return [...jobs.values()].filter(j => j.running);
    }
}
