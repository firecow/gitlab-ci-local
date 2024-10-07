import chalk from "chalk";
import {Job} from "./job";
import {Parser} from "./parser";
import {Utils} from "./utils";
import {WriteStreams} from "./write-streams";
import {Executor} from "./executor";
import fs from "fs-extra";
import {Argv} from "./argv";
import {AssertionError} from "assert";

export class Commander {

    static async runPipeline (argv: Argv, parser: Parser, writeStreams: WriteStreams) {
        const jobs = parser.jobs;
        const stages = parser.stages;

        let potentialStarters = [...jobs.values()];
        potentialStarters = potentialStarters.filter(j => j.when !== "never");
        potentialStarters = potentialStarters.filter(j => j.when !== "manual" || argv.manual.includes(j.name));
        await Executor.runLoop(argv, jobs, stages, potentialStarters);
        await Commander.printReport({
            showTimestamps: argv.showTimestamps,
            stateDir: argv.stateDir,
            writeStreams: writeStreams,
            jobs: jobs,
            stages: stages,
            jobNamePad: parser.jobNamePad,
        });
    }

    static async runJobsInStage (argv: Argv, parser: Parser, writeStreams: WriteStreams) {
        const jobs = parser.jobs.filter(j => j.stage === argv.stage);
        const stages = parser.stages;

        let potentialStarters = [...jobs.values()];
        potentialStarters = potentialStarters.filter(j => j.when !== "never");
        potentialStarters = potentialStarters.filter(j => j.when !== "manual" || argv.manual.includes(j.name));
        potentialStarters = potentialStarters.filter(j => j.stage === argv.stage);
        await Executor.runLoop(argv, jobs, stages, potentialStarters);
        await Commander.printReport({
            showTimestamps: argv.showTimestamps,
            stateDir: argv.stateDir,
            writeStreams: writeStreams,
            jobs: jobs,
            stages: stages,
            jobNamePad: parser.jobNamePad,
        });
    }

    static async runJobs (argv: Argv, parser: Parser, writeStreams: WriteStreams) {
        const needs = argv.needs || argv.onlyNeeds;
        const jobArgs = argv.job;
        const jobs = parser.jobs;
        const stages = parser.stages;

        const potentialStarters: Job[] = [];
        const jobSet = needs ? new Set(jobs) : new Set<Job>();
        jobArgs.forEach(jobArgName => {
            const baseJobs = jobs.filter(j => j.baseName == jobArgName || j.name === jobArgName);
            for (const b of baseJobs) {
                jobSet.add(b);
                if (needs) {
                    potentialStarters.push(...Executor.getPastToWaitFor(jobs, stages, b, argv.manual));
                }
                potentialStarters.push(b);
            }
        });

        if (potentialStarters.length === 0) {
            throw new AssertionError({message: chalk`{blueBright ${jobArgs.join(",")}} could not be found`});
        }

        const starters = argv.onlyNeeds
            ? potentialStarters.filter(p => !jobArgs.includes(p.name))
            : potentialStarters;

        await Executor.runLoop(argv, Array.from(jobSet), stages, starters);
        await Commander.printReport({
            showTimestamps: argv.showTimestamps,
            stateDir: argv.stateDir,
            writeStreams: writeStreams,
            jobs: jobs,
            stages: stages,
            jobNamePad: parser.jobNamePad,
        });
    }

    static async printReport ({stateDir, showTimestamps, writeStreams, jobs, stages, jobNamePad}: {
        showTimestamps: boolean;
        stateDir: string;
        writeStreams: WriteStreams;
        jobs: ReadonlyArray<Job>;
        stages: readonly string[];
        jobNamePad: number;
    }) {

        writeStreams.stdout("\n");

        const renderDuration = (duration: string) => showTimestamps ? ` [${duration.padStart(7)}]` : "";

        const preScripts: {successful: Job[]; failed: Job[]; warned: Job[]} = {
            successful: [],
            failed: [],
            warned: [],
        };
        const afterScripts: {warned: Job[]} = {
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

            if (job.jobStatus === "success") {
                preScripts.successful.push(job);
            } else if (job.jobStatus === "warning") {
                preScripts.warned.push(job);
            } else {
                preScripts.failed.push(job);
            }
        }

        if (preScripts.successful.length !== 0) {
            preScripts.successful.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            preScripts.successful.forEach(({coveragePercent, name, prettyDuration}) => {
                const namePad = name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgGreenBright  PASS }${renderDuration(prettyDuration)} {blueBright ${namePad}}`);
                if (coveragePercent) {
                    writeStreams.stdout(chalk` ${coveragePercent}% {grey coverage}`);
                }
                writeStreams.stdout("\n");
            });
        }

        if (preScripts.warned.length !== 0) {
            preScripts.warned.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            for (const {name, prettyDuration} of preScripts.warned) {
                const namePad = name.padEnd(jobNamePad);
                const safeName = Utils.safeDockerString(name);
                writeStreams.stdout(chalk`{black.bgYellowBright  WARN }${renderDuration(prettyDuration)} {blueBright ${namePad}}  pre_script\n`);
                const outputLog = await fs.readFile(`${stateDir}/output/${safeName}.log`, "utf8");
                for (const line of outputLog.split(/\r?\n/).filter(j => !j.includes("[32m$ ")).filter(j => j !== "").slice(-3)) {
                    writeStreams.stdout(chalk`  {yellow >} ${line}\n`);
                }
            }
        }

        if (afterScripts.warned.length !== 0) {
            afterScripts.warned.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            afterScripts.warned.forEach(({name, prettyDuration}) => {
                const namePad = name.padEnd(jobNamePad);
                writeStreams.stdout(chalk`{black.bgYellowBright  WARN }${renderDuration(prettyDuration)} {blueBright ${namePad}}  after_script\n`);
            });
        }

        if (preScripts.failed.length !== 0) {
            preScripts.failed.sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage));
            for (const {name, prettyDuration} of preScripts.failed) {
                const namePad = name.padEnd(jobNamePad);
                const safeName = Utils.safeDockerString(name);
                writeStreams.stdout(chalk`{black.bgRed  FAIL }${renderDuration(prettyDuration)} {blueBright ${namePad}}\n`);
                const outputLog = await fs.readFile(`${stateDir}/output/${safeName}.log`, "utf8");
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
            const name = e.name;
            const url = e.url;
            writeStreams.stdout(chalk`{blueBright ${job.name}} environment: \{ name: {bold ${name}}`);
            if (url != null) {
                writeStreams.stdout(chalk`, url: {bold ${url}}`);
            }
            writeStreams.stdout(" }\n");
        }
    }

    static runList (parser: Parser, writeStreams: WriteStreams, listAll: boolean) {
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
            const needs = job.needs?.filter(n => !n.project && !n.pipeline).map(n => n.job);
            const allowFailure = job.allowFailure ? "true " : "false";
            let jobLine = chalk`{blueBright ${job.name.padEnd(jobNamePad)}}  ${job.description.padEnd(descriptionPadEnd)}  `;
            jobLine += chalk`{yellow ${job.stage.padEnd(stagePadEnd)}}  ${job.when.padEnd(whenPadEnd)}  ${allowFailure.padEnd(11)}`;
            if (needs) {
                jobLine += chalk`    [{blueBright ${needs}}]`;
            }
            writeStreams.stdout(`${jobLine}\n`);
        };

        jobs.forEach((job) => renderLine(job));
    }

    static runJson (parser: Parser, writeStreams: WriteStreams) {
        const jobs = [...parser.jobs.values()];
        const json: any[] = [];

        jobs.forEach((job) => {
            json.push({
                name: job.name,
                description: job.description,
                stage: job.stage,
                when: job.when,
                allow_failure: job.allowFailure,
                needs: job.needs?.filter(n => !n.project && !n.pipeline),
                rules: job.rules,
            });
        });

        writeStreams.stdout(`${JSON.stringify(json, null, 2)}\n`);
    }

    static runCsv (parser: Parser, writeStreams: WriteStreams, all: boolean) {
        const stages = parser.stages;
        let jobs = [...parser.jobs.values()];
        jobs.sort((a, b) => {
            return stages.indexOf(a.stage) - stages.indexOf(b.stage);
        });

        if (!all) {
            jobs = jobs.filter(j => j.when !== "never");
        }

        writeStreams.stdout("name;description;stage;when;allowFailure;needs\n");
        jobs.forEach((job) => {
            const needs = job.needs?.filter(n => !n.project && !n.pipeline).map(n => n.job).join(",") ?? [];
            writeStreams.stdout(`${job.name};"${job.description}";${job.stage};${job.when};${job.allowFailure};[${needs}]\n`);
        });
    }

}
