import chalk from "chalk";
import {Job} from "./job";
import {Parser} from "./parser";
import {Utils} from "./utils";
import {WriteStreams} from "./types/write-streams";
import {JobExecutor} from "./job-executor";
import fs from "fs-extra";
import {Argv} from "./argv";

export class Commander {

    static async runPipeline(argv: Argv, parser: Parser, writeStreams: WriteStreams) {
        const jobs = parser.jobs;
        const stages = parser.stages;

        let potentialStarters = [...jobs.values()];
        potentialStarters = potentialStarters.filter(j => j.when !== "never");
        potentialStarters = potentialStarters.filter(j => j.when !== "manual" || argv.manual.includes(j.name));
        await JobExecutor.runLoop(argv, jobs, stages, potentialStarters);
        await Commander.printReport(argv.cwd, writeStreams, jobs, stages, parser.jobNamePad);
    }

    static async runJobs(argv: Argv, parser: Parser, writeStreams: WriteStreams) {
        const needs = argv.needs;
        const jobArgs = argv.job;
        const jobs = parser.jobs;
        const stages = parser.stages;


        let potentialStarters: Job[] = [];
        const jobPoolMap = needs ? new Map<string, Job>(jobs) : new Map<string, Job>();
        jobArgs.forEach(jobName => {
            const job = Utils.getJobByName(jobs, jobName);
            jobPoolMap.set(jobName, job);
            if (needs) {
                potentialStarters = potentialStarters.concat(JobExecutor.getPastToWaitFor(jobs, stages, job, argv.manual));
            }
            potentialStarters.push(job);
        });

        await JobExecutor.runLoop(argv, jobPoolMap, stages, potentialStarters);
        await Commander.printReport(argv.cwd, writeStreams, jobs, stages, parser.jobNamePad);
    }

    static printReport = async (cwd: string, writeStreams: WriteStreams, jobs: ReadonlyMap<string, Job>, stages: readonly string[], jobNamePad: number) => {

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
            for (const {name} of preScripts.warned) {
                const namePad = name.padEnd(jobNamePad);
                const safeName = Utils.getSafeJobName(name);
                writeStreams.stdout(chalk`{black.bgYellowBright  WARN } {blueBright ${namePad}}  pre_script\n`);
                const outputLog = await fs.readFile(`${cwd}/.gitlab-ci-local/output/${safeName}.log`, "utf8");
                for (const line of outputLog.split(/\r?\n/).filter(j => !j.includes("[32m$ ")).filter(j => j !== "").slice(-3)) {
                    writeStreams.stdout(chalk`  {yellow >} ${line}\n`);
                }
            }
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
            for (const {name} of preScripts.failed) {
                const namePad = name.padEnd(jobNamePad);
                const safeName = Utils.getSafeJobName(name);
                writeStreams.stdout(chalk`{black.bgRed  FAIL } {blueBright ${namePad}}\n`);
                const outputLog = await fs.readFile(`${cwd}/.gitlab-ci-local/output/${safeName}.log`, "utf8");
                for (const line of outputLog.split(/\r?\n/).filter(j => !j.includes("[32m$ ")).filter(j => j !== "").slice(-3)) {
                    writeStreams.stdout(chalk`  {red >} ${line}\n`);
                }
            }
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

    static runList(parser: Parser, writeStreams: WriteStreams, listAll: boolean) {
        const stages = parser.stages;
        let jobs = [...parser.jobs.values()];
        jobs.sort((a, b) => {
            return stages.indexOf(a.stage) - stages.indexOf(b.stage);
        });

        let whenPadEnd = 4;
        jobs.forEach(j => whenPadEnd = Math.max(j.when.length, whenPadEnd));

        let stagePadEnd = 5;
        stages.forEach(s => stagePadEnd = Math.max(s.length, stagePadEnd));

        let descriptionPadEnd = 11;
        jobs.forEach(j => descriptionPadEnd = Math.max(j.description.length, descriptionPadEnd));

        const jobNamePad = parser.jobNamePad;

        if (!listAll) {
            jobs = jobs.filter(j => j.when !== "never");
        }

        writeStreams.stdout(chalk`{grey ${"name".padEnd(jobNamePad)}  ${"description".padEnd(descriptionPadEnd)}}  `);
        writeStreams.stdout(chalk`{grey ${"stage".padEnd(stagePadEnd)}  ${"when".padEnd(whenPadEnd)}}  `);
        writeStreams.stdout(chalk`{grey allow_failure  needs}\n`);

        const renderLine = (job: Job) => {
            const needs = job.needs;
            const allowFailure = job.allowFailure ? "true " : "false";
            let jobLine = chalk`{blueBright ${job.name.padEnd(jobNamePad)}}  ${job.description.padEnd(descriptionPadEnd)}  `;
            jobLine += chalk`{yellow ${job.stage.padEnd(stagePadEnd)}}  ${job.when.padEnd(whenPadEnd)}  ${allowFailure.padEnd(11)}`;
            if (needs) {
                jobLine += chalk`    [{blueBright ${needs.map(n => n.job).join(",")}}]`;
            }
            writeStreams.stdout(`${jobLine}\n`);
        };

        jobs.forEach((job) => renderLine(job));
    }

    static runJson(parser: Parser, writeStreams: WriteStreams) {
        const jobs = [...parser.jobs.values()];
        const json: any[] = [];

        jobs.forEach((job) => {
            json.push({
                name: job.name,
                description: job.description,
                stage: job.stage,
                when: job.when,
                allow_failure: job.allowFailure,
                needs: job.needs,
            });
        });

        writeStreams.stdout(`${JSON.stringify(json, null, 2)}\n`);
    }

}
