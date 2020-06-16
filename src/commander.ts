import * as c from "ansi-colors";

import { Job } from "./job";
import { Parser } from "./parser";

export class Commander {

    public static async runPipeline(parser: Parser, manualArgs: string[]) {
        const jobs = parser.getJobs();
        const stages = parser.getStages().concat();
        const stageNames = parser.getStageNames();

        let stage = stages.shift();
        while (stage !== undefined) {
            const jobsInStage = stage.getJobs();
            const stageName = stage.name;

            if (!stage.isRunning()) {
                process.stdout.write(`=> ${c.yellow(`${stageName}`)} <=\n`);
                if (jobsInStage.length === 0 && !stage.isRunning()) {
                    process.stdout.write(`=> ${c.yellow(`${stageName}`)} has no jobs\n`);
                }
            }

            for (const job of jobsInStage) {
                if (job.isManual() && !manualArgs.includes(job.name) && !job.isFinished()) {
                    process.stdout.write(`${job.getJobNameString()} ${c.magentaBright("skipped")} when:manual\n`);
                    job.setFinished(true);
                    continue;
                }

                if (job.isNever() && !job.isFinished()) {
                    process.stdout.write(`${job.getJobNameString()} ${c.magentaBright("skipped")} when:never\n`);
                    job.setFinished(true);
                    continue;
                }

                if (!job.isRunning() && !job.isFinished()) {
                    /* tslint:disable */
                    // noinspection ES6MissingAwait
                    job.start();
                    /* tslint:enabled */
                }
            }

            // Find jobs that can be started, because their needed jobs have finished
            for (const job of jobs) {
                if (job.isRunning() || job.isFinished() || job.needs === null) {
                    continue;
                }

                const finishedJobNames = jobs.filter((e) => e.isFinished()).map((j) => j.name);
                const needsConditionMet = job.needs.every((v) => (finishedJobNames.indexOf(v) >= 0));
                if (needsConditionMet) {
                    // noinspection ES6MissingAwait
                    job.start();
                }
            }

            await new Promise((r) => setTimeout(r, 50));

            if (stage.isFinished()) {
                if (!stage.isSuccess()) {
                    Commander.printReport(jobs, stageNames);
                    process.exit(2);
                }
                stage = stages.shift();
            }
        }

        Commander.printReport(jobs, stageNames);
    }

    static runList(parser: Parser) {
        const stageNames = Array.from(parser.getStages()).map((s) => s.name);
        const jobs = Array.from(parser.getJobs()).sort((a, b) => {
            const whenPrio = ["never"];
            if (a.stage !== b.stage) {
                return stageNames.indexOf(a.stage) - stageNames.indexOf(b.stage);
            }
            return whenPrio.indexOf(b.when) - whenPrio.indexOf(a.when);
        });


        let whenPadEnd = 0;
        parser.getJobs().forEach(j => whenPadEnd = Math.max(j.when.length + 1, whenPadEnd));

        let stagePadEnd = 0;
        parser.getStageNames().forEach(s => stagePadEnd = Math.max(s.length + 1, stagePadEnd));

        for (const job of jobs) {
            const needs = job.needs;
            const allowFailure = job.allowFailure ? 'warning' : ''
            let jobLine = `${job.getJobNameString()} ${c.yellow(`${job.stage.padEnd(stagePadEnd)}`)} ${job.when.padEnd(whenPadEnd)} ${allowFailure.padEnd(8)}`;
            if (needs) {
                jobLine += ` [${c.blueBright(`${needs.join(',')}`)}]`
            }
            process.stdout.write(`${jobLine}\n`);
        }
    }

    static async runSingleJob(parser: Parser, jobName: string, needs: boolean) {
        const jobs: Job[] = [];
        const stageNames = parser.getStageNames();
        const foundJob = parser.getJobByName(jobName);
        jobs.push(foundJob);

        if (needs) {
            // Recursive backwards traversal to find parant needs.
            let needed: string[] = [];
            if (foundJob.needs) needed = needed.concat(foundJob.needs);
            while (needed.length > 0) {
                const need = needed.pop();
                if (need) {
                    const needJob = parser.getJobByName(need);
                    jobs.unshift(needJob);
                    if (needJob.needs) needed = needed.concat(needJob.needs);
                }
            }
        }

        for (const job of jobs) {
            await job.start();
        }

        Commander.printReport(jobs, stageNames);
    };

    static printReport = (jobs: ReadonlyArray<Job>, stageNames: ReadonlyArray<string>) => {
        process.stdout.write(`\n<<<<< ------- ${c.magenta("report")} ------- >>>>>\n`);

        jobs = jobs.concat().sort((a, b) => {
            const whenPrio = ["never"];
            if (a.stage !== b.stage) {
                return stageNames.indexOf(a.stage) - stageNames.indexOf(b.stage);
            }

            return whenPrio.indexOf(b.when) - whenPrio.indexOf(a.when);
        });

        for (const job of jobs) {
            if (!job.isStarted()) {
                process.stdout.write(`${job.getJobNameString()} not started\n`);
            } else if (job.getPrescriptsExitCode() === 0) {
                process.stdout.write(`${job.getJobNameString()} ${c.green("successful")}\n`);
            } else if (job.allowFailure) {
                process.stdout.write(`${job.getJobNameString()} ${c.yellowBright(`warning with code ${job.getPrescriptsExitCode()}`)}\n`);
            } else {
                process.stdout.write(`${job.getJobNameString()} ${c.red(`exited with code ${job.getPrescriptsExitCode()}`)}\n`);
            }
        }
    };

}
