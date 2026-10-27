import fs from "fs-extra";
import path from "node:path";
import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const cwd = "tests/test-cases/report-json-trigger";

test("report-json <trigger job never gets a logPath, since it writes no output log>", async () => {
    const writeStreams = new WriteStreamsMock();
    const stateDir = ".gitlab-ci-local-report-json-trigger";
    const reportPath = `${cwd}/${stateDir}/report.json`; // relative to invocation cwd (repo root)
    await handler({
        cwd,
        stateDir,
        reportJson: reportPath,
        shellIsolation: true,
    }, writeStreams);

    const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    expect(report.jobs).toHaveLength(1);
    const triggerJob = report.jobs[0];
    expect(triggerJob.name).toBe("trigger-job");
    expect(triggerJob.started).toBe(true);
    expect(triggerJob.status).toBe("success");
    // Trigger jobs delegate to a child pipeline and never write output/<safeJobName>.log themselves.
    expect(triggerJob.logPath).toBeNull();
    expect(fs.existsSync(path.resolve(cwd, `${stateDir}/output/trigger-job.log`))).toBe(false);
});
