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
import {EventType, PipelineInitEvent} from "./web/events/event-types.js";
import {GCLDatabase} from "./web/persistence/database.js";
import {EventRecorder} from "./web/events/event-recorder.js";
import {LogFileManager} from "./web/persistence/log-file-manager.js";

let eventRecorder: EventRecorder | null = null;
let eventDb: GCLDatabase | null = null;
let logFileManager: LogFileManager | null = null;

const generateGitIgnore = (cwd: string, stateDir: string) => {
    const gitIgnoreFilePath = `${cwd}/${stateDir}/.gitignore`;
    const gitIgnoreContent = "*\n!.gitignore\n";
    if (!fs.existsSync(gitIgnoreFilePath)) {
        fs.outputFileSync(gitIgnoreFilePath, gitIgnoreContent);
    }
};

const emitInitReady = (pipelineIid: number) => {
    const emitter = EventEmitter.getInstance();
    if (!emitter.isEnabled()) return;
    emitter.emit({
        type: EventType.PIPELINE_INIT_PHASE,
        timestamp: Date.now(),
        pipelineId: `${pipelineIid}`,
        pipelineIid,
        phase: "ready",
        message: "Ready to run jobs",
        progress: 100,
    } as PipelineInitEvent);
};

// Get pipeline IID - uses passed env var in web UI mode, or file-based state in CLI mode
const getEffectivePipelineIid = async (cwd: string, stateDir: string, shouldIncrement: boolean): Promise<number> => {
    // Web UI mode: use the IID passed from the web server
    const envIid = process.env.GCIL_PIPELINE_IID;
    if (envIid) {
        return parseInt(envIid, 10);
    }

    // CLI mode: use file-based state
    if (shouldIncrement) {
        await state.incrementPipelineIid(cwd, stateDir);
    }
    return state.getPipelineIid(cwd, stateDir);
};

export async function handler (args: any, writeStreams: WriteStreams, jobs: Job[] = [], childPipelineDepth = 0) {
    assert(childPipelineDepth <= 2, "Parent and child pipelines have a maximum depth of two levels of child pipelines.");
    const argv = await Argv.build({...args, childPipelineDepth: childPipelineDepth}, writeStreams);
    const cwd = argv.cwd;
    const stateDir = argv.stateDir;
    const file = argv.file;
    let parser: Parser | null = null;

    // Auto-detect Docker socket location if DOCKER_HOST is not set
    Utils.detectDockerSocket();

    if (argv.completion) {
        yargs(process.argv.slice(2)).showCompletionScript();
        return [];
    }

    // Enable events and recording for web UI only when explicitly enabled
    // GCIL_ prefix avoids yargs .env("GCL") parsing it as a CLI argument
    // Web UI is default OFF - only enabled via `gitlab-ci-local serve` command
    if (process.env.GCIL_WEB_UI_ENABLED === "true") {
        EventEmitter.getInstance().enable();
        // Initialize database, log file manager, and event recorder if not already done
        if (!eventRecorder) {
            const dbPath = path.join(cwd, stateDir, "web-ui.db");
            eventDb = new GCLDatabase(dbPath);
            await eventDb.init();
            // Use file-based logging to prevent memory growth from large log output
            logFileManager = new LogFileManager(path.join(cwd, stateDir));
            eventRecorder = new EventRecorder(eventDb, logFileManager);
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
        const shouldIncrement = argv.needs || argv.onlyNeeds;
        const pipelineIid = await getEffectivePipelineIid(cwd, stateDir, shouldIncrement);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        if (!argv.mountCwd) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker", pipelineIid);
        }
        emitInitReady(pipelineIid);
        await Commander.runJobs(argv, parser, writeStreams);
        if (argv.needs || argv.onlyNeeds) {
            writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
        }
    } else if (argv.stage) {
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        const pipelineIid = await getEffectivePipelineIid(cwd, stateDir, false);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        if (!argv.mountCwd) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker", pipelineIid);
        }
        emitInitReady(pipelineIid);
        await Commander.runJobsInStage(argv, parser, writeStreams);
        writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    } else {
        generateGitIgnore(cwd, stateDir);
        const time = process.hrtime();
        const pipelineIid = await getEffectivePipelineIid(cwd, stateDir, true);
        parser = await Parser.create(argv, writeStreams, pipelineIid, jobs);
        if (!argv.mountCwd) {
            await Utils.rsyncTrackedFiles(cwd, stateDir, ".docker", pipelineIid);
        }
        emitInitReady(pipelineIid);
        await Commander.runPipeline(argv, parser, writeStreams);
        if (childPipelineDepth == 0) writeStreams.stderr(chalk`{grey pipeline finished} in {grey ${prettyHrtime(process.hrtime(time))}}\n`);
    }
    writeStreams.flush();

    // Clean up event recording
    if (eventRecorder && eventDb) {
        eventRecorder.destroy(); // Properly remove listeners
        if (logFileManager) {
            logFileManager.cleanup();
            logFileManager = null;
        }
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
    if (logFileManager) {
        logFileManager.cleanup();
        logFileManager = null;
    }
    if (eventDb) {
        eventDb.close();
        eventDb = null;
    }
    EventEmitter.reset();
}
