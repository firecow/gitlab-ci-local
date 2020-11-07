import * as c from "ansi-colors";
import * as childProcess from "child_process";
import * as util from "util";

import {Job} from "./job";
import {Parser} from "./parser";
import {Utils} from "./utils";

const exec = util.promisify(childProcess.exec);

export class Commander {

    public static async runPipeline(parser: Parser, manualArgs: string[]) {
        const jobs = parser.getJobs();
        const stages = parser.getStages().concat();

        const skippingNever = [];
        const skippingManual = [];
        for (const st of stages) {
            const jobsInStage = st.getJobs();
            for (const job of jobsInStage) {
                if (job.isManual() && !manualArgs.includes(job.name) && !job.isFinished()) {
                    skippingManual.push(job);
                    continue;
                }

                if (job.isNever() && !job.isFinished()) {
                    skippingNever.push(job);
                }
            }
        }

        if (skippingNever.length > 0) {
            skippingNever.forEach(Utils.printJobNames);
            process.stdout.write(` ${c.magentaBright("skipped")} when:never\n`);
        }
        if (skippingManual.length > 0) {
            skippingManual.forEach(Utils.printJobNames);
            process.stdout.write(` ${c.magentaBright("skipped")} when:manual\n`);
        }

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
                    job.setFinished(true);
                    continue;
                }

                if (job.isNever() && !job.isFinished()) {
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

            await new Promise((r) => setTimeout(r, 50));

            if (stage.isFinished()) {
                if (!stage.isSuccess()) {
                    await Commander.printReport(jobs);
                    process.exit(2);
                }
                stage = stages.shift();
            }
        }

        await Commander.printReport(jobs);
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
    };

    static printReport = async (jobs: ReadonlyArray<Job>) => {
        process.stdout.write(`\n`);

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

        if (preScripts.never.length !== 0) {
            process.stdout.write(`${c.magenta("not started")} `);
            preScripts.never.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (preScripts.successful.length !== 0) {
            process.stdout.write(`${c.green("successful")} `);
            preScripts.successful.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (preScripts.warned.length !== 0) {
            process.stdout.write(`${c.yellowBright("warning")} `);
            preScripts.warned.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (afterScripts.warned.length !== 0) {
            process.stdout.write(`${c.yellowBright("after script")} `);
            afterScripts.warned.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        if (preScripts.failed.length !== 0) {
            process.stdout.write(`${c.red("failure")} `);
            preScripts.failed.forEach(Utils.printJobNames);
            process.stdout.write(`\n`);
        }

        for (const job of preScripts.successful) {
            const e = job.environment;
            if (e == null) {
                continue;
            }
            let res;
            res = await exec(`printf ${e.name}`, {env: job.getEnvs()});
            const name = res.stdout;
            res = await exec(`printf ${e.url}`, {env: job.getEnvs()});
            const url = res.stdout;
            if (url !== 'undefined') {
                process.stdout.write(`${c.blueBright(job.name)} environment: { name: ${c.bold(name)}, url: ${c.bold(url)} }\n`);
            } else {
                process.stdout.write(`${c.blueBright(job.name)} environment: { name: ${c.bold(name)} }\n`);
            }

        }

    };

}
