import * as c from "ansi-colors";

import {Job} from "./job";
import {Parser} from "./parser";

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
                if (jobsInStage.length === 0 && !stage.isRunning()) {
                    process.stdout.write(`=> ${c.yellow(`${stageName}`)} has no jobs\n`);
                } else {
                    process.stdout.write(`=> ${c.yellow(`${stageName}`)} <=\n`);
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
                if ((job.isManual() && !manualArgs.includes(job.name)) || job.isRunning() || job.isFinished() || job.needs === null) {
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
        parser.getJobs().forEach(j => whenPadEnd = Math.max(j.when.length, whenPadEnd));

        let stagePadEnd = 0;
        parser.getStageNames().forEach(s => stagePadEnd = Math.max(s.length, stagePadEnd));

        let descriptionPadEnd = 0;
        parser.getJobs().forEach(j => descriptionPadEnd = Math.max(j.getDescription().length, descriptionPadEnd));

        for (const job of jobs) {
            const needs = job.needs;
            const allowFailure = job.allowFailure ? 'warning' : '';
            let jobLine = `${job.getJobNameString()}  ${job.getDescription().padEnd(descriptionPadEnd)}`;
            jobLine += `  ${c.yellow(`${job.stage.padEnd(stagePadEnd)}`)}  ${job.when.padEnd(whenPadEnd)}  ${allowFailure.padEnd(7)}`;
            if (needs) {
                jobLine += `  [${c.blueBright(`${needs.join(',')}`)}]`;
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
            // Recursive backwards traversal to find parent needs.
            let needed: string[] = [];
            if (foundJob.needs) {
                needed = needed.concat(foundJob.needs);
            }
            while (needed.length > 0) {
                const need = needed.pop();
                if (need) {
                    const needJob = parser.getJobByName(need);
                    jobs.unshift(needJob);
                    if (needJob.needs) {
                        needed = needed.concat(needJob.needs);
                    }
                }
            }
        }

        for (const job of jobs) {
            await job.start();
        }

        Commander.printReport(jobs, stageNames);
    };

    static printReport = (jobs: ReadonlyArray<Job>, stageNames: ReadonlyArray<string>) => {
        process.stdout.write(`\n`);

        jobs = jobs.concat().sort((a, b) => {
            const whenPrio = ["never"];
            if (a.stage !== b.stage) {
                return stageNames.indexOf(a.stage) - stageNames.indexOf(b.stage);
            }

            return whenPrio.indexOf(b.when) - whenPrio.indexOf(a.when);
        });

        const preScripts: any = {
            never: [],
            successful: [],
            failed: [],
            warned: []
        };
        const afterScripts: any = {
            warned: []
        };

        for (const job of jobs) {
            if (job.isStarted() && job.getAfterPrescriptsExitCode() !== 0) {
                afterScripts.warned.push(job);
            }
        }

        for (const job of jobs) {
            if (!job.isStarted()) {
                preScripts.never.push(job);
            } else if (job.getPrescriptsExitCode() === 0) {
                preScripts.successful.push(job);
            } else if (job.allowFailure) {
                preScripts.warned.push(job);
            } else {
                preScripts.failed.push(job);
            }
        }

        let terminalLength = 0;
        const printJobName = (job: Job, i: number, arr: Job[]) => {
            terminalLength += job.name.length;
            if (terminalLength > 180) {
                process.stdout.write(`\n${"".padEnd(2)}`);
                terminalLength = 0;
            }
            if (i === arr.length - 1) {
                process.stdout.write(`${c.blueBright(`${job.name}`)}`);
            } else {
                process.stdout.write(`${c.blueBright(`${job.name}`)}, `);
            }
        };

        if (preScripts.never.length !== 0) {
            process.stdout.write(`${c.magenta("not started")} `);
            terminalLength = 0;
            preScripts.never.forEach(printJobName);
            process.stdout.write(`\n`);
        }

        if (preScripts.successful.length !== 0) {
            process.stdout.write(`${c.green("successful")} `);
            terminalLength = 0;
            preScripts.successful.forEach(printJobName);
            process.stdout.write(`\n`);
        }

        if (preScripts.warned.length !== 0) {
            process.stdout.write(`${c.yellowBright("warning")} `);
            terminalLength = 0;
            preScripts.warned.forEach(printJobName);
            process.stdout.write(`\n`);
        }

        if (afterScripts.warned.length !== 0) {
            process.stdout.write(`${c.yellowBright("after script")} `);
            terminalLength = 0;
            afterScripts.warned.forEach(printJobName);
            process.stdout.write(`\n`);
        }

        if (preScripts.failed.length !== 0) {
            process.stdout.write(`${c.red("failure")} `);
            terminalLength = 0;
            preScripts.failed.forEach(printJobName);
            process.stdout.write(`\n`);
        }

    };

}
