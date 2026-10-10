import fs from "fs-extra";
import path from "node:path";
import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Executor} from "../../../src/executor.js";
import {Job} from "../../../src/job.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const cwd = "tests/test-cases/report-json";

test("report-json <full pipeline>", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-report-json-pipeline";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    await handler({
        cwd,
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.schemaVersion).toBe(1);
    expect(report.status).toBe("failed");
    expect(typeof report.pipelineIid).toBe("number");
    expect(report.jobs).toHaveLength(9);

    const statuses: Record<string, string> = {};
    for (const job of report.jobs) {
        statuses[job.name] = job.status;
    }
    expect(statuses).toEqual({
        "success-job": "success",
        "allowed-fail-job": "failed_allowed",
        "exit-codes-allowed-job": "failed_allowed",
        "after-fail-job": "success_with_warnings",
        "fail-job": "failed",
        "dotenv-job": "skipped",
        "cached-job": "skipped",
        "manual-job": "manual",
        "never-job": "disabled",
    });

    for (const job of report.jobs) {
        expect(job.cached).toBe(false);
        const leftoverTmpFiles = fs.readdirSync(path.dirname(reportPath)).filter((f) => f.includes(".tmp"));
        expect(leftoverTmpFiles).toEqual([]);
        if (job.started) {
            expect(job.durationMs).toBeGreaterThanOrEqual(0);
            expect(fs.existsSync(path.resolve(cwd, job.logPath))).toBe(true);
        } else {
            expect(job.durationMs).toBeNull();
            expect(job.logPath).toBeNull();
        }
    }

    const successJob = report.jobs.find((j: any) => j.name === "success-job");
    expect(successJob.services).toEqual([]);
    expect(successJob.artifacts).toEqual([]);
});

test("report-json <stage test>", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-report-json-stage";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    await handler({
        cwd,
        stage: "test",
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.status).toBe("failed");
    const statuses: Record<string, string> = {};
    for (const job of report.jobs) {
        statuses[job.name] = job.status;
    }
    expect(statuses).toEqual({
        "success-job": "success",
        "allowed-fail-job": "failed_allowed",
        "exit-codes-allowed-job": "failed_allowed",
        "after-fail-job": "success_with_warnings",
        "fail-job": "failed",
    });
});

test("report-json <named job, exit codes unchanged>", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-report-json-job";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    const jobs: Job[] = [];
    await handler({
        cwd,
        job: ["success-job"],
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams, jobs);

    expect(Executor.getFailed(jobs)).toHaveLength(0);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.status).toBe("success");
    const statuses: Record<string, string> = {};
    for (const job of report.jobs) {
        statuses[job.name] = job.status;
    }
    expect(statuses).toEqual({
        "success-job": "success",
        "allowed-fail-job": "skipped",
        "exit-codes-allowed-job": "skipped",
        "after-fail-job": "skipped",
        "fail-job": "skipped",
        "dotenv-job": "skipped",
        "cached-job": "skipped",
        "manual-job": "manual",
        "never-job": "disabled",
    });
});

test("report-json <named failing job marks run failed>", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-report-json-failing-job";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    const jobs: Job[] = [];
    await handler({
        cwd,
        job: ["fail-job"],
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams, jobs);

    expect(Executor.getFailed(jobs)).toHaveLength(1);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.status).toBe("failed");
    const failJob = report.jobs.find((j: any) => j.name === "fail-job");
    expect(failJob.status).toBe("failed");
    expect(failJob.prescriptsExitCode).toBe(1);
    expect(fs.existsSync(path.resolve(cwd, failJob.logPath))).toBe(true);
});

test("report-json <named job with dotenv artifacts>", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-report-json-dotenv-job";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    const jobs: Job[] = [];
    await handler({
        cwd,
        job: ["dotenv-job"],
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams, jobs);

    expect(Executor.getFailed(jobs)).toHaveLength(0);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.status).toBe("success");
    const dotenvJob = report.jobs.find((j: any) => j.name === "dotenv-job");
    expect(dotenvJob.status).toBe("success");
    expect(dotenvJob.started).toBe(true);
    expect(dotenvJob.artifacts).toEqual(["build.env"]);
    expect(fs.existsSync(path.resolve(cwd, dotenvJob.logPath))).toBe(true);
});

test("report-json <named job reflects a real cache hit on the second run>", async () => {
    const stateDir = ".gitlab-ci-local-report-json-cached-job";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    await fs.rm(path.resolve(cwd, stateDir), {recursive: true, force: true});

    let writeStreams = new WriteStreamsMock();
    await handler({
        cwd,
        job: ["cached-job"],
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams);
    let report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    let cachedJob = report.jobs.find((j: any) => j.name === "cached-job");
    expect(cachedJob.status).toBe("success");
    // No cache exists yet on the first run, so copyCacheIn has nothing to restore.
    expect(cachedJob.cached).toBe(false);

    writeStreams = new WriteStreamsMock();
    await handler({
        cwd,
        job: ["cached-job"],
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams);
    report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    cachedJob = report.jobs.find((j: any) => j.name === "cached-job");
    expect(cachedJob.status).toBe("success");
    // The second run restores the cache pushed by the first, exercising the real copyCacheIn path.
    expect(cachedJob.cached).toBe(true);
});
