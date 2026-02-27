import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import * as state from "../../../src/state.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("pipeline-iid increments", async () => {
    const cwd = "tests/test-cases/pipeline-iid";
    const stateDir = ".gitlab-ci-local";

    await fs.remove(`${cwd}/${stateDir}/state.yml`);
    await fs.remove(`${cwd}/${stateDir}/state.yml.lock`);

    const iid0 = await state.incrementPipelineIid(cwd, stateDir);
    expect(iid0).toBe(0);

    const iid1 = await state.incrementPipelineIid(cwd, stateDir);
    expect(iid1).toBe(1);

    const iid2 = await state.incrementPipelineIid(cwd, stateDir);
    expect(iid2).toBe(2);

    const readBack = await state.getPipelineIid(cwd, stateDir);
    expect(readBack).toBe(2);

    await fs.remove(`${cwd}/${stateDir}/state.yml`);
    await fs.remove(`${cwd}/${stateDir}/state.yml.lock`);
});

test("pipeline-iid concurrent increments produce unique values", async () => {
    const cwd = "tests/test-cases/pipeline-iid";
    const stateDir = ".gitlab-ci-local";

    await fs.remove(`${cwd}/${stateDir}/state.yml`);
    await fs.remove(`${cwd}/${stateDir}/state.yml.lock`);

    const concurrency = 20;
    const results = await Promise.all(
        Array.from({length: concurrency}, () => state.incrementPipelineIid(cwd, stateDir))
    );

    const unique = new Set(results);
    expect(unique.size).toBe(concurrency);

    const sorted = [...results].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({length: concurrency}, (_, i) => i));

    const finalIid = await state.getPipelineIid(cwd, stateDir);
    expect(finalIid).toBe(concurrency - 1);

    await fs.remove(`${cwd}/${stateDir}/state.yml`);
    await fs.remove(`${cwd}/${stateDir}/state.yml.lock`);
});

test("pipeline-iid <test-job>", async () => {
    const cwd = "tests/test-cases/pipeline-iid";
    const stateDir = ".gitlab-ci-local";

    await fs.remove(`${cwd}/${stateDir}/state.yml`);
    await fs.remove(`${cwd}/${stateDir}/state.yml.lock`);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd,
        job: ["test-job"],
        needs: true,
    }, writeStreams);

    const found = writeStreams.stdoutLines.filter((l) => l.includes("CI_PIPELINE_IID=0"));
    expect(found.length).toBe(1);

    await fs.remove(`${cwd}/${stateDir}/state.yml`);
    await fs.remove(`${cwd}/${stateDir}/state.yml.lock`);
});
