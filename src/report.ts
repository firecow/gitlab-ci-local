import fs from "fs-extra";
import crypto from "node:crypto";
import path from "node:path";
import {Job} from "./job.js";

export type ReportJobStatus =
    "success" |
    "success_with_warnings" |
    "failed_allowed" |
    "failed" |
    "manual" |
    "skipped" |
    "disabled";

export type ReportJob = {
    name: string;
    baseName: string;
    matrixVariables: {[key: string]: string} | null;
    stage: string;
    status: ReportJobStatus;
    allowFailure: boolean | {exit_codes: number | number[]};
    when: string;
    started: boolean;
    prescriptsExitCode: number | null;
    afterScriptsExitCode: number;
    coverage: string | null;
    durationMs: number | null;
    logPath: string | null;
    services: string[];
    servicesLogPaths: string[];
    artifacts: string[];
    cached: boolean;
};

export type Report = {
    schemaVersion: 1;
    pipelineIid: number;
    status: "success" | "success_with_warnings" | "failed";
    jobs: ReportJob[];
};

/** Mirrors the classification done by Commander.printReport, so human and --report-json output never disagree. */
export function jobReportStatus (job: Pick<Job, "started" | "when" | "preScriptsExitCode" | "afterScriptsExitCode" | "jobStatus">): ReportJobStatus {
    if (job.started) {
        if (job.preScriptsExitCode === 0) {
            return job.afterScriptsExitCode === 0 ? "success" : "success_with_warnings";
        }
        return job.jobStatus === "warning" ? "failed_allowed" : "failed";
    }
    if (job.when === "manual") return "manual";
    if (job.when === "never") return "disabled";
    return "skipped";
}

export function buildReport ({pipelineIid, jobs, cwd, stateDir}: {
    pipelineIid: number;
    jobs: ReadonlyArray<Job>;
    cwd: string;
    stateDir: string;
}): Report {
    const reportJobs = jobs.map((job) => buildJobReport(job, cwd, stateDir));
    const statuses = reportJobs.map((job) => job.status);
    return {
        schemaVersion: 1,
        pipelineIid,
        status: statuses.includes("failed") ?
            "failed" :
            statuses.some((s) => s === "success_with_warnings" || s === "failed_allowed") ? "success_with_warnings" : "success",
        jobs: reportJobs,
    };
}

/** Writes the report atomically (<path>.<unique>.tmp + move), so a consumer polling the path never reads a torn
 *  file, and concurrent runs targeting the same path never race on a shared tmp file. */
export async function writeReport (reportJsonPath: string, report: Report) {
    const tmpPath = `${reportJsonPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    await fs.outputJson(tmpPath, report, {spaces: 2});
    await fs.move(tmpPath, reportJsonPath, {overwrite: true});
}

function buildJobReport (job: Job, cwd: string, stateDir: string): ReportJob {
    const durationHrtime = job.durationHrtime;
    // Trigger jobs never write to output/<safeJobName>.log — they delegate to a child pipeline instead.
    const logPath = job.started && !job.trigger ? path.join(stateDir, "output", `${job.safeJobName}.log`) : null;

    const servicesLogPaths: string[] = [];
    if (job.started) {
        job.services.forEach((service, index) => {
            const serviceLogPath = path.join(stateDir, "services-output", job.safeJobName, `${service.name}-${index}.log`);
            if (fs.pathExistsSync(`${cwd}/${serviceLogPath}`)) servicesLogPaths.push(serviceLogPath);
        });
    }

    return {
        name: job.name,
        baseName: job.baseName,
        matrixVariables: job.matrixVariables,
        stage: job.stage,
        status: jobReportStatus(job),
        allowFailure: job.allowFailure,
        when: job.when,
        started: job.started,
        prescriptsExitCode: job.preScriptsExitCode,
        afterScriptsExitCode: job.afterScriptsExitCode,
        coverage: job.coveragePercent,
        durationMs: durationHrtime ? Math.round(durationHrtime[0] * 1000 + durationHrtime[1] / 1e6) : null,
        logPath,
        services: job.services.map((service) => service.name),
        servicesLogPaths,
        artifacts: job.artifacts?.paths ?? [],
        cached: job.cacheRestored,
    };
}
