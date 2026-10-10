import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import {Job} from "../src/job.js";
import {ReportJobStatus, buildReport, jobReportStatus, writeReport} from "../src/report.js";

type StatusInput = Parameters<typeof jobReportStatus>[0];

const statusJob = (overrides: Partial<StatusInput> = {}): StatusInput => ({
    started: false,
    when: "on_success",
    preScriptsExitCode: null,
    afterScriptsExitCode: 0,
    jobStatus: "pending",
    ...overrides,
});

test.concurrent("jobReportStatus maps every status", () => {
    const cases: [StatusInput, ReportJobStatus][] = [
        [statusJob({started: true, preScriptsExitCode: 0, afterScriptsExitCode: 0, jobStatus: "success"}), "success"],
        [statusJob({started: true, preScriptsExitCode: 0, afterScriptsExitCode: 1, jobStatus: "success"}), "success_with_warnings"],
        [statusJob({started: true, preScriptsExitCode: 2, afterScriptsExitCode: 0, jobStatus: "warning"}), "failed_allowed"],
        [statusJob({started: true, preScriptsExitCode: 2, afterScriptsExitCode: 0, jobStatus: "failed"}), "failed"],
        [statusJob({started: false, when: "manual"}), "manual"],
        [statusJob({started: false, when: "on_failure"}), "skipped"],
        [statusJob({started: false, when: "never"}), "disabled"],
    ];
    for (const [job, expected] of cases) {
        expect(jobReportStatus(job)).toBe(expected);
    }
});

const reportJob = (overrides: any = {}): Job => ({
    name: "my-job",
    baseName: "my-job",
    matrixVariables: null,
    stage: "test",
    when: "on_success",
    allowFailure: false,
    started: true,
    preScriptsExitCode: 0,
    afterScriptsExitCode: 0,
    jobStatus: "success",
    coveragePercent: null,
    durationHrtime: [1, 500000000],
    safeJobName: "my-job",
    services: [],
    artifacts: null,
    cacheRestored: false,
    trigger: undefined,
    ...overrides,
} as unknown as Job);

test.concurrent("buildReport job entry shape", () => {
    const report = buildReport({
        pipelineIid: 42,
        cwd: ".",
        stateDir: ".gitlab-ci-local",
        jobs: [
            reportJob(),
            reportJob({name: "fail-job", safeJobName: "fail-job", preScriptsExitCode: 1, jobStatus: "failed", durationHrtime: [2, 250000000]}),
            reportJob({name: "skipped-job", safeJobName: "skipped-job", started: false, durationHrtime: null}),
            reportJob({name: "warned-job", safeJobName: "warned-job", afterScriptsExitCode: 1}),
            reportJob({name: "allowed-job", safeJobName: "allowed-job", preScriptsExitCode: 3, jobStatus: "warning", allowFailure: true}),
            reportJob({name: "dotenv-job", safeJobName: "dotenv-job", artifacts: {reports: {dotenv: "build.env"}}}),
            reportJob({name: "matrix-job", safeJobName: "matrix-job", baseName: "matrix-job", matrixVariables: {OS: "linux"}}),
            reportJob({name: "cached-job", safeJobName: "cached-job", cacheRestored: true}),
            reportJob({name: "trigger-job", safeJobName: "trigger-job", trigger: {include: "child.yml"}}),
        ],
    });

    const reportJobEntry = (overrides: any = {}) => {
        const safeJobName = overrides.safeJobName ?? overrides.name ?? "my-job";
        return {
            baseName: "my-job",
            matrixVariables: null,
            stage: "test",
            status: "success",
            allowFailure: false,
            when: "on_success",
            started: true,
            prescriptsExitCode: 0,
            afterScriptsExitCode: 0,
            coverage: null,
            durationMs: 1500,
            logPath: `.gitlab-ci-local/output/${safeJobName}.log`,
            services: [],
            servicesLogPaths: [],
            artifacts: [],
            cached: false,
            ...overrides,
        };
    };

    expect(report).toEqual({
        schemaVersion: 1,
        pipelineIid: 42,
        status: "failed",
        jobs: [
            reportJobEntry({name: "my-job"}),
            reportJobEntry({name: "fail-job", status: "failed", prescriptsExitCode: 1, durationMs: 2250}),
            reportJobEntry({name: "skipped-job", status: "skipped", started: false, durationMs: null, logPath: null}),
            reportJobEntry({name: "warned-job", status: "success_with_warnings", afterScriptsExitCode: 1}),
            reportJobEntry({name: "allowed-job", status: "failed_allowed", prescriptsExitCode: 3, allowFailure: true}),
            reportJobEntry({name: "dotenv-job"}),
            reportJobEntry({name: "matrix-job", baseName: "matrix-job", matrixVariables: {OS: "linux"}}),
            reportJobEntry({name: "cached-job", cached: true}),
            reportJobEntry({name: "trigger-job", logPath: null}),
        ],
    });
});

test.concurrent("buildReport pipeline status", () => {
    const base = {pipelineIid: 1, cwd: ".", stateDir: ".gitlab-ci-local"};
    expect(buildReport({...base, jobs: [reportJob()]}).status).toBe("success");
    expect(buildReport({...base, jobs: [reportJob({afterScriptsExitCode: 1})]}).status).toBe("success_with_warnings");
    expect(buildReport({...base, jobs: [reportJob(), reportJob({name: "j", safeJobName: "j", started: false, durationHrtime: null})]}).status).toBe("success");
    expect(buildReport({...base, jobs: [reportJob({preScriptsExitCode: 3, jobStatus: "warning", allowFailure: true})]}).status).toBe("success_with_warnings");
    expect(buildReport({...base, jobs: [reportJob({preScriptsExitCode: 3, jobStatus: "warning", allowFailure: true}), reportJob({name: "j", safeJobName: "j", preScriptsExitCode: 1, jobStatus: "failed"})]}).status).toBe("failed");
});

test.concurrent("writeReport writes valid json and leaves no tmp file", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gcl-report-test-"));
    try {
        const reportPath = path.join(dir, "nested", "report.json");
        await writeReport(reportPath, buildReport({pipelineIid: 7, cwd: ".", stateDir: ".gitlab-ci-local", jobs: [reportJob()]}));
        const parsed = JSON.parse(fs.readFileSync(reportPath, "utf8"));
        expect(parsed.schemaVersion).toBe(1);
        expect(parsed.jobs).toHaveLength(1);
        const leftoverTmpFiles = fs.readdirSync(path.dirname(reportPath)).filter((f) => f.includes(".tmp"));
        expect(leftoverTmpFiles).toEqual([]);
    } finally {
        fs.removeSync(dir);
    }
});
