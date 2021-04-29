import * as chalk from "chalk";
import {Job} from "./job";
import {Parser} from "./parser";
import {Utils} from "./utils";
import {WriteStreams} from "./types/write-streams";
import {JobExecutor} from "./job-executor";

export class Commander {

    static async runPipeline(parser: Parser, writeStreams: WriteStreams, manualOpts: string[], privileged: boolean) {
        const jobs = parser.jobs;
        const stages = parser.stages;

        let potentialStarters = [...jobs.values()];
        potentialStarters = potentialStarters.filter(j => j.when !== "never");
        potentialStarters = potentialStarters.filter(j => j.when !== "manual" || manualOpts.includes(j.name));
        await JobExecutor.runLoop(jobs, stages, potentialStarters, manualOpts, privileged);
        await Commander.printReport(writeStreams, jobs, stages, parser.jobNamePad);
    }

    static async runSingleJob(parser: Parser, writeStreams: WriteStreams, jobArgs: string[], needs: boolean, manualOpts: string[], privileged: boolean) {
        const jobs = parser.jobs;
        const stages = parser.stages;

        let potentialStarters: Job[] = [];
        const jobPoolMap = needs ? new Map<string, Job>(jobs) : new Map<string, Job>();
        jobArgs.forEach(jobName => {
            const job = Utils.getJobByName(jobs, jobName);
            jobPoolMap.set(jobName, job);
            if (needs) {
                potentialStarters = potentialStarters.concat(JobExecutor.getPastToWaitFor(jobs, stages, job, manualOpts));
            }
            potentialStarters.push(job);
        });

        await JobExecutor.runLoop(jobPoolMap, stages, potentialStarters, manualOpts, privileged);
        await Commander.printReport(writeStreams, jobs, stages, parser.jobNamePad);
    }

    static printReport = async (writeStreams: WriteStreams, jobs: ReadonlyMap<string, Job>, stages: readonly string[], jobNamePad: number) => {
        writeStreams.stdout("\n");

        const preScripts: { successful: Job[]; failed: Job[]; warned: Job[] } = {
            successful: [],
            failed: [],
            warned: [],
        };
        const afterScripts: { warned: Job[] } = {
            warned: [],
        };

        for (const job of jobs.values()) {
            if (job.started && job.afterScriptsExitCode !== 0) {
                afterScripts.warned.push(job);
            }
        }

        for (const job of jobs.values()) {
            if (!job.started) {
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
            preScripts.successful.forEach((job) => {
                const namePad = job.name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgGreenBright  PASS } {blueBright ${namePad}}`);
                if (job.coveragePercent) {
                    writeStreams.stdout(chalk` ${job.coveragePercent}% {grey coverage}`);
                }
                writeStreams.stdout("\n");
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

    static runList(parser: Parser, writeStreams: WriteStreams) {
        const stages = parser.stages;
        const jobs = [...parser.jobs.values()];
        jobs.sort((a, b) => {
            return stages.indexOf(a.stage) - stages.indexOf(b.stage);
        });

        let whenPadEnd = 0;
        jobs.forEach(j => whenPadEnd = Math.max(j.when.length, whenPadEnd));

        let stagePadEnd = 0;
        stages.forEach(s => stagePadEnd = Math.max(s.length, stagePadEnd));

        let descriptionPadEnd = 0;
        jobs.forEach(j => descriptionPadEnd = Math.max(j.description.length, descriptionPadEnd));

        const jobNamePad = parser.jobNamePad;

        const neverJobs = jobs.filter(j => j.when === "never");
        const nonNeverJobs = jobs.filter(j => j.when !== "never");

        writeStreams.stdout(chalk`{grey ${"name".padEnd(jobNamePad)}  ${"description".padEnd(descriptionPadEnd)}}  `);
        writeStreams.stdout(chalk`{grey ${"stage".padEnd(stagePadEnd)}  ${"when".padEnd(whenPadEnd)}}  `);
        writeStreams.stdout(chalk`{grey allow_failure  needs}\n`);

        const renderLine = (job: Job) => {
            const needs = job.needs;
            const allowFailure = job.allowFailure ? "true " : "false";
            let jobLine = chalk`{blueBright ${job.name.padEnd(jobNamePad)}}  ${job.description.padEnd(descriptionPadEnd)}  `;
            jobLine += chalk`  {yellow ${job.stage.padEnd(stagePadEnd)}}  ${job.when.padEnd(whenPadEnd)}  ${allowFailure.padEnd(11)}`;
            if (needs) {
                jobLine += chalk`    [{blueBright ${needs.join(",")}}]`;
            }
            writeStreams.stdout(`${jobLine}\n`);
        };

        neverJobs.forEach((job) => renderLine(job));
        nonNeverJobs.forEach((job) => renderLine(job));
    }

}
