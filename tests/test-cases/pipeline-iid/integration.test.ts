import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import * as state from "../../../src/state.js";
import fs from "fs-extra";
import path from "path";

const cwd = "tests/test-cases/pipeline-iid";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("pipeline-iid sequential increments return 0, 1, 2", async () => {
    const stateDir = ".gitlab-ci-local-sequential";
    const stateFile = path.join(cwd, stateDir, "state.yml");
    const lockFile = path.join(cwd, stateDir, "state.lock");
    try {
        const first = await state.incrementPipelineIid(cwd, stateDir);
        const second = await state.incrementPipelineIid(cwd, stateDir);
        const third = await state.incrementPipelineIid(cwd, stateDir);

        expect(first).toBe(0);
        expect(second).toBe(1);
        expect(third).toBe(2);
    } finally {
        fs.removeSync(stateFile);
        fs.removeSync(lockFile);
    }
});

test.concurrent("pipeline-iid concurrent increments produce unique IIDs", async () => {
    const stateDir = ".gitlab-ci-local-concurrent";
    const stateFile = path.join(cwd, stateDir, "state.yml");
    const lockFile = path.join(cwd, stateDir, "state.lock");
    try {
        const count = 20;
        const promises = Array.from({length: count}, () =>
            state.incrementPipelineIid(cwd, stateDir),
        );
        const results = await Promise.all(promises);

        const sorted = [...results].sort((a, b) => a - b);
        expect(sorted).toEqual(Array.from({length: count}, (_, i) => i));
    } finally {
        fs.removeSync(stateFile);
        fs.removeSync(lockFile);
    }
});

test.concurrent("pipeline-iid stale lock from dead PID is auto-cleaned", async () => {
    const stateDir = ".gitlab-ci-local-stale-lock";
    const stateFile = path.join(cwd, stateDir, "state.yml");
    const lockFile = path.join(cwd, stateDir, "state.lock");
    try {
        fs.ensureDirSync(path.dirname(lockFile));
        fs.writeFileSync(lockFile, "999999999");

        const result = await state.incrementPipelineIid(cwd, stateDir);
        expect(result).toBe(0);
        expect(fs.existsSync(lockFile)).toBe(false);
    } finally {
        fs.removeSync(stateFile);
        fs.removeSync(lockFile);
    }
});

test.concurrent("pipeline-iid handler increments IID across runs", async () => {
    const stateDir = ".gitlab-ci-local-handler";
    const stateFile = path.join(cwd, stateDir, "state.yml");
    const lockFile = path.join(cwd, stateDir, "state.lock");
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({cwd, stateDir}, writeStreams);

        const iid = await state.getPipelineIid(cwd, stateDir);
        expect(iid).toBe(0);

        const writeStreams2 = new WriteStreamsMock();
        await handler({cwd, stateDir}, writeStreams2);

        const iid2 = await state.getPipelineIid(cwd, stateDir);
        expect(iid2).toBe(1);
    } finally {
        fs.removeSync(stateFile);
        fs.removeSync(lockFile);
    }
});
