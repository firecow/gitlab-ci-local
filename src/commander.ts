import * as chalk from "chalk";
import {Job} from "./job";
import {Parser} from "./parser";
import {Utils} from "./utils";
import {WriteStreams} from "./types/write-streams";

export class Commander {

    static async runPipeline(parser: Parser, writeStreams: WriteStreams, manualArgs: string[], privileged: boolean) {
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
                    job.start(privileged);
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
                    job.start(privileged);
                }
            }

            await new Promise((r) => setTimeout(r, 10));

            if (stage.isFinished()) {
                if (!stage.isSuccess()) {
                    await Commander.printReport(writeStreams, jobs, parser.getStageNames(), parser.jobNamePad);
                    process.exit(1);
                }
                stage = stages.shift();
            }
        }

        await Commander.printReport(writeStreams, jobs, parser.getStageNames(), parser.jobNamePad);
    }

    static runList(parser: Parser, writeStreams: WriteStreams) {
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

        const neverJobs = jobs.filter(j => j.when === "never");
        const nonNeverJobs = jobs.filter(j => j.when !== "never");

        const renderLine = (job: Job) => {
            const needs = job.needs;
            const allowFailure = job.allowFailure ? chalk`{black.bgYellowBright  ONLY WARN }` : chalk`{black.bgRed  CAN FAIL  }`;
            let jobLine = `${job.getJobNameString()}  ${job.description.padEnd(descriptionPadEnd)}`;
            jobLine += chalk`  {yellow ${job.stage.padEnd(stagePadEnd)}}  ${job.when.padEnd(whenPadEnd)}  ${allowFailure.padEnd(11)}`;
            if (needs) {
                jobLine += chalk`  [{blueBright ${needs.join(",")}}]`;
            }
            writeStreams.stdout(`${jobLine}\n`);
        };

        neverJobs.forEach((job) => renderLine(job));
        nonNeverJobs.forEach((job) => renderLine(job));
    }

    static async runSingleJob(parser: Parser, writeStreams: WriteStreams, jobName: string, needs: boolean, privileged: boolean) {
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
            await job.start(privileged);
        }

        await Commander.printReport(writeStreams, jobs, parser.getStageNames(), parser.jobNamePad);
    }

    static printReport = async (writeStreams: WriteStreams, jobs: ReadonlyArray<Job>, stages: readonly string[], jobNamePad: number) => {
        writeStreams.stdout("\n");

        const preScripts: { successful: Job[]; failed: Job[]; warned: Job[] } = {
            successful: [],
            failed: [],
            warned: [],
        };
        const afterScripts: { warned: Job[] } = {
            warned: [],
        };

        for (const job of jobs) {
            if (job.isStarted() && job.afterScriptsExitCode !== 0) {
                afterScripts.warned.push(job);
            }
        }

        for (const job of jobs) {
            if (!job.isStarted()) {
                continue;
            }

            if (job.preScriptsExitCode === 0) {
                preScripts.successful.push(job);
            } else if (job.allowFailure) {
                preScripts.warned.push(job);
            } else {
                preScripts.failed.push(job);
            }
        }

        if (preScripts.successful.length !== 0) {
            preScripts.successful.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            preScripts.successful.forEach(({name}) => {
                const namePad = name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgGreenBright  PASS } {blueBright ${namePad}}\n`);
            });
        }

        if (preScripts.warned.length !== 0) {
            preScripts.warned.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            preScripts.warned.forEach(({name}) => {
                const namePad = name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgYellowBright  WARN } {blueBright ${namePad}}  pre_script\n`);
            });
        }

        if (afterScripts.warned.length !== 0) {
            afterScripts.warned.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            afterScripts.warned.forEach(({name}) => {
                const namePad = name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgYellowBright  WARN } {blueBright ${namePad}}  after_script\n`);
            });
        }

        if (preScripts.failed.length !== 0) {
            preScripts.failed.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            preScripts.failed.forEach(({name}) => {
                const namePad = name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgRed  FAIL } {blueBright ${namePad}}\n`);
            });
        }

        for (const job of preScripts.successful) {
            const e = job.environment;
            if (e == null) {
                continue;
            }
            const name = Utils.expandText(e.name, job.expandedVariables);
            const url = Utils.expandText(e.url, job.expandedVariables);
            writeStreams.stdout(chalk`{blueBright ${job.name}} environment: \{ name: {bold ${name}}`);
            if (url != null) {
                writeStreams.stdout(chalk`, url: {bold ${url}}`);
            }
            writeStreams.stdout(" }\n");
        }

    };

}
