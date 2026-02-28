import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import * as state from "../../../src/state.js";
import fs from "fs-extra";
import path from "path";

const cwd = "tests/test-cases/pipeline-iid";
const stateDir = ".gitlab-ci-local";
const stateFile = path.join(cwd, stateDir, "state.yml");
const lockFile = path.join(cwd, stateDir, "state.lock");

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

afterEach(() => {
    fs.removeSync(stateFile);
    fs.removeSync(lockFile);
});

describe("pipeline-iid state locking", () => {
    test("sequential increments return 0, 1, 2", async () => {
        const first = await state.incrementPipelineIid(cwd, stateDir);
        const second = await state.incrementPipelineIid(cwd, stateDir);
        const third = await state.incrementPipelineIid(cwd, stateDir);

        expect(first).toBe(0);
        expect(second).toBe(1);
        expect(third).toBe(2);
    });

    test("concurrent increments produce unique IIDs", async () => {
        const count = 20;
        const promises = Array.from({length: count}, () =>
            state.incrementPipelineIid(cwd, stateDir),
        );
        const results = await Promise.all(promises);

        const sorted = [...results].sort((a, b) => a - b);
        expect(sorted).toEqual(Array.from({length: count}, (_, i) => i));
    });

    test("stale lock from dead PID is auto-cleaned", async () => {
        fs.ensureDirSync(path.dirname(lockFile));
        fs.writeFileSync(lockFile, "999999999");

        const result = await state.incrementPipelineIid(cwd, stateDir);
        expect(result).toBe(0);
        expect(fs.existsSync(lockFile)).toBe(false);
    });
});

test("pipeline-iid handler increments IID across runs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({cwd: cwd}, writeStreams);

    const iid = await state.getPipelineIid(cwd, stateDir);
    expect(iid).toBe(0);

    const writeStreams2 = new WriteStreamsMock();
    await handler({cwd: cwd}, writeStreams2);

    const iid2 = await state.getPipelineIid(cwd, stateDir);
    expect(iid2).toBe(1);
});
