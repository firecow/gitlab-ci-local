import * as yaml from "js-yaml";
import chalk from "chalk-template";
import path from "path";
import fs from "fs-extra";
import yargs from "yargs";
import {Commander} from "./commander.js";
import {Parser} from "./parser.js";
import * as state from "./state.js";
import prettyHrtime from "pretty-hrtime";
import {WriteStreams} from "./write-streams.js";
import {cleanupJobResources, Job} from "./job.js";
import {Utils} from "./utils.js";
import {Argv} from "./argv.js";
import assert from "assert";
import {EventEmitter} from "./web/events/event-emitter.js";
import {GCLDatabase} from "./web/persistence/database.js";
import {EventRecorder} from "./web/events/event-recorder.js";

let eventRecorder: EventRecorder | null = null;
let eventDb: GCLDatabase | null = null;

const generateGitIgnore = (cwd: string, stateDir: string) => {
    const gitIgnoreFilePath = `${cwd}/${stateDir}/.gitignore`;
    const gitIgnoreContent = "*\n!.gitignore\n";
    if (!fs.existsSync(gitIgnoreFilePath)) {
        fs.outputFileSync(gitIgnoreFilePath, gitIgnoreContent);
    }
};

export async function handler (args: any, writeStreams: WriteStreams, jobs: Job[] = [], childPipelineDepth = 0) {
    assert(childPipelineDepth <= 2, "Parent and child pipelines have a maximum depth of two levels of child pipelines.");
    const argv = await Argv.build({...args, childPipelineDepth: childPipelineDepth}, writeStreams);
    const cwd = argv.cwd;
    const stateDir = argv.stateDir;
    const file = argv.file;
    let parser: Parser | null = null;

    if (argv.completion) {
        yargs(process.argv.slice(2)).showCompletionScript();
        return [];
    }

    // Enable events and recording for web UI (GCIL_ prefix avoids yargs .env("GCL") parsing)
    const webUiDbPath = path.join(cwd, stateDir, "web-ui.db");
    if (process.env.GCIL_WEB_UI_ENABLED === "true" || fs.existsSync(webUiDbPath)) {
        EventEmitter.getInstance().enable();
        // Initialize database and event recorder if not already done
        if (!eventRecorder) {
            const dbPath = path.join(cwd, stateDir, "web-ui.db");
            eventDb = new GCLDatabase(dbPath);
            await eventDb.init();
            eventRecorder = new EventRecorder(eventDb);
        }
    }

    assert(fs.existsSync(`${cwd}/${file}`), `${path.resolve(cwd)}/${file} could not be found`);

    if (argv.preview) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs, false);
        const gitlabData = parser.gitlabData;
        for (const jobName of Object.keys(gitlabData)) {
            if (jobName === "stages") {
                continue;
            }
            if (jobName.startsWith(".") || ["include", "after_script", "before_script", "default"].includes(jobName)) {
                // Remove since these are redundant info which are already "extended" in the jobs
                delete gitlabData[jobName];
            }
        }
        writeStreams.stdout(`---\n${yaml.dump(gitlabData, {lineWidth: 160})}`);
    } else if (argv.list || argv.listAll) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runList(parser, writeStreams, argv.listAll);
    } else if (argv.validateDependencyChain) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.validateDependencyChain(parser);
        writeStreams.stdout(chalk`{green ✓ All job dependencies are valid}\n`);
    } else if (argv.listJson) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runJson(parser, writeStreams);
    } else if (argv.listCsv || argv.listCsvAll) {
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        Commander.runCsv(parser, writeStreams, argv.listCsvAll);
    } else if (argv.job.length > 0) {
        assert(argv.stage === null, "You cannot use --stage when starting individual jobs");
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        if (argv.needs || argv.onlyNeeds) {
            await state.incrementPipelineIid(cwd, stateDir);
        }
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        if (!argv.mountCwd) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        }
        await Commander.runJobs(argv, parser, writeStreams);
        if (argv.needs || argv.onlyNeeds) {
            writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
        }
    } else if (argv.stage) {
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        if (!argv.mountCwd) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        }
        await Commander.runJobsInStage(argv, parser, writeStreams);
        writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    } else {
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        await state.incrementPipelineIid(cwd, stateDir);
        const pipelineIid = await state.getPipelineIid(cwd, stateDir);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        if (!argv.mountCwd) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker");
        }
        await Commander.runPipeline(argv, parser, writeStreams);
        if (childPipelineDepth == 0) writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
    writeStreams.flush();

    // Clean up event recording
    if (eventRecorder && eventDb) {
        eventRecorder.destroy(); // Properly remove listeners
        eventDb.close();
        eventRecorder = null;
        eventDb = null;
        EventEmitter.reset(); // Reset the singleton state
    }

    return cleanupJobResources(jobs);
}

// Export cleanup function for testing purposes
export function cleanupEventSystem () {
    if (eventRecorder) {
        eventRecorder.destroy();
        eventRecorder = null;
    }
    if (eventDb) {
        eventDb.close();
        eventDb = null;
    }
    EventEmitter.reset();
}
