import {blueBright, bold, green, magenta, red, yellow, yellowBright} from "ansi-colors";

import {Job} from "./job";
import {Parser} from "./parser";
import {Utils} from "./utils";

export class Commander {

    static async runPipeline(parser: Parser, manualArgs: string[]) {
        const jobs = parser.getJobs();
        const stages = parser.getStages().concat();

        let stage = stages.shift();
        while (stage != null) {
            const jobsInStage = stage.getJobs();
            for (const job of jobsInStage) {

                if (job.isManual() && !manualArgs.includes(job.name) && !job.isFinished()) {
                    job.setFinished(true);
                    continue;
                }

                if (job.isNever() && !job.isFinished()) {
                    job.setFinished(true);
                    continue;
                }

                if (!job.isRunning() && !job.isFinished()) {
                    // noinspection ES6MissingAwait
                    job.start();
                }
            }

            // Find jobs that can be started, because their needed jobs have finished
            for (const job of jobs) {
                if ((job.isManual() && !manualArgs.includes(job.name)) || job.isRunning() || job.isFinished() || job.needs === null || job.isNever()) {
                    continue;
                }

                const finishedJobNames = jobs.filter((e) => e.isFinished()).map((j) => j.name);
                const needsConditionMet = job.needs.every((v) => (finishedJobNames.indexOf(v) >= 0));
                if (needsConditionMet) {
                    // noinspection ES6MissingAwait
                    job.start();
                }
            }

            await new Promise((r) => setImmediate(r));

            if (stage.isFinished()) {
                if (!stage.isSuccess()) {
                    await Commander.printReport(jobs);
                    process.exit(1);
                }
                stage = stages.shift();
            }
        }

        await Commander.printReport(jobs);
    }

    static runList(parser: Parser) {
        const stageNames = Array.from(parser.getStages()).map((s) => s.name);
        const jobs = Array.from(parser.getJobs()).sort((a, b) => {
            return stageNames.indexOf(a.stage) - stageNames.indexOf(b.stage);
        });

        let whenPadEnd = 0;
        parser.getJobs().forEach(j => whenPadEnd = Math.max(j.when.length, whenPadEnd));

        let stagePadEnd = 0;
        parser.getStageNames().forEach(s => stagePadEnd = Math.max(s.length, stagePadEnd));

        let descriptionPadEnd = 0;
        parser.getJobs().forEach(j => descriptionPadEnd = Math.max(j.description.length, descriptionPadEnd));

        for (const job of jobs) {
            const needs = job.needs;
            const allowFailure = job.allowFailure ? 'warning' : '';
            let jobLine = `${job.getJobNameString()}  ${job.description.padEnd(descriptionPadEnd)}`;
            jobLine += `  ${yellow(job.stage.padEnd(stagePadEnd))}  ${job.when.padEnd(whenPadEnd)}  ${allowFailure.padEnd(7)}`;
            if (needs) {
                jobLine += `  [${blueBright(needs.join(','))}]`;
            }
            process.stdout.write(`${jobLine}\n`);
        }
    }

    static async runSingleJob(parser: Parser, jobName: string,   needs: boolean) {
        const jobs: Job[] = [];
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

        await Commander.printReport(jobs);
    }

    static printReport = async (jobs: ReadonlyArray<Job>) => {
        process.stdout.write(`\n`);

        const preScripts: { never: Job[], successful: Job[], failed: Job[], warned: Job[] } = {
            never: [],
            successful: [],
            failed: [],
            warned: []
        };
        const afterScripts: { warned: Job[] } = {
            warned: []
        };

        for (const job of jobs) {
            if (job.isStarted() && job.afterScriptsExitCode !== 0) {
                afterScripts.warned.push(job);
            }
        }

        for (const job of jobs) {
            if (!job.isStarted()) {
                preScripts.never.push(job);
            } else if (job.preScriptsExitCode === 0) {
                preScripts.successful.push(job);
            } else if (job.allowFailure) {
                preScripts.warned.push(job);
            } else {
                preScripts.failed.push(job);
            }
        }

        if (preScripts.never.length !== 0) {
            process.stdout.write(`${magenta("not started")} `);
            preScripts.never.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (preScripts.successful.length !== 0) {
            process.stdout.write(`${green("successful")} `);
            preScripts.successful.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (preScripts.warned.length !== 0) {
            process.stdout.write(`${yellowBright("warning")} `);
            preScripts.warned.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (afterScripts.warned.length !== 0) {
            process.stdout.write(`${yellowBright("after script")} `);
            afterScripts.warned.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (preScripts.failed.length !== 0) {
            process.stdout.write(`${red("failure")} `);
            preScripts.failed.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        for (const job of preScripts.successful) {
            const e = job.environment;
            if (e == null) {
                continue;
            }
            const name = Utils.expandText(e.name, job.expandedVariables);
            const url = Utils.expandText(e.url, job.expandedVariables);
            if (url != null) {
                process.stdout.write(`${blueBright(job.name)} environment: { name: ${bold(name)}, url: ${bold(url)} }\n`);
            } else {
                process.stdout.write(`${blueBright(job.name)} environment: { name: ${bold(name)} }\n`);
            }

        }

    };

}
