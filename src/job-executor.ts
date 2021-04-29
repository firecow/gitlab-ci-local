import * as chalk from "chalk";
import {Job} from "./job";
import {ExitError} from "./types/exit-error";

export class JobExecutor {

    static async runLoop(jobs: ReadonlyMap<string, Job>, stages: readonly string[], potentialStarters: Job[], manuals: string[], privileged: boolean) {
        let runningJobs = [];
        let startCandidates = [];

        do {
            startCandidates = JobExecutor.getStartCandidates(jobs, stages, potentialStarters, manuals);
            startCandidates.forEach(j => j.start(privileged).then());
            runningJobs = JobExecutor.getRunning(jobs);
            await new Promise<void>((resolve) => { setTimeout(() => { resolve(); }, 5); });
        } while (runningJobs.length > 0);
    }

    static getStartCandidates(jobs: ReadonlyMap<string, Job>, stages: readonly string[], potentialStarters: readonly Job[], manuals: string[]) {
        const startCandidates = [];
        for (const job of [...new Set<Job>(potentialStarters)]) {
            if (job.started) continue;

            const jobsToWaitFor = JobExecutor.getPastToWaitFor(jobs, stages, job, manuals);
            if (!JobExecutor.isPastFailed(jobsToWaitFor) && !JobExecutor.isNotFinished(jobsToWaitFor)) {
                startCandidates.push(job);
            }
        }
        return startCandidates;
    }

    static isPastFailed(jobsToWaitFor: ReadonlyArray<Job>) {
        const failJobs = jobsToWaitFor.filter(j => {
            if (j.allowFailure) {
                return false;
            }
            return (j.preScriptsExitCode ? j.preScriptsExitCode : 0) > 0;
        });
        return failJobs.length > 0;
    }

    static isNotFinished(jobsToWaitFor: ReadonlyArray<Job>) {
        const notFinishedJobs = jobsToWaitFor.filter(j => !j.finished);
        return notFinishedJobs.length > 0;
    }

    static getRunning(jobs: ReadonlyMap<string, Job>) {
        return [...jobs.values()].filter(j => j.running);
    }

    static getPastToWaitFor(jobs: ReadonlyMap<string, Job>, stages: readonly string[], job: Job, manuals: string[]) {
        const jobsToWaitForSet = new Set<Job>();
        let waitForLoopArray: Job[] = [job];

        while (waitForLoopArray.length > 0) {
            const loopJob = waitForLoopArray.pop();
            if (!loopJob) break;
            if (loopJob.needs) {
                loopJob.needs.forEach(needJob => {
                    const found = jobs.get(needJob);
                    if (found) {
                        if (found.when === "never") {
                            throw new ExitError(chalk`{blueBright ${found.name}} is when:never, but its needed by {blueBright ${loopJob.name}}`);
                        }
                        if (found.when === "manual" && !manuals.includes(found.name)) {
                            throw new ExitError(chalk`{blueBright ${found.name}} is when:manual, its needed by {blueBright ${loopJob.name}}, and not specified in --manual`);
                        }
                        waitForLoopArray.push(found);
                    }
                });
            } else {
                const stageIndex = stages.indexOf(loopJob.stage);
                const pastStages = stages.slice(0, stageIndex);
                pastStages.forEach((pastStage) => {
                    waitForLoopArray = waitForLoopArray.concat([...jobs.values()].filter(j => j.stage === pastStage));
                });
                waitForLoopArray = waitForLoopArray.filter(j => j.when !== "never");
                waitForLoopArray = waitForLoopArray.filter(j => j.when !== "manual" || manuals.includes(j.name));
            }
            waitForLoopArray.forEach(j => jobsToWaitForSet.add(j));
        }
        return [...jobsToWaitForSet];
    }
}
