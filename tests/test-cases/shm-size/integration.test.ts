import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Job, cleanupJobResources} from "../../../src/job.js";
import {initSpawnSpy, initBashSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

let jobs: Job[] = [];
beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

beforeEach(async () => {
    jobs = [];
});

afterEach(async () => {
    await cleanupJobResources(jobs);
});

test("shm-size <test-job> --shm-size=256m", async () => {
    const bashSpy = initBashSpy([]);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shm-size",
        job: ["test-job"],
        shmSize: "256m",
    }, writeStreams);

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--shm-size=256m/), expect.any(String));
});

test("shm-size <test-job> without --shm-size", async () => {
    const bashSpy = initBashSpy([]);
    const callsBefore = bashSpy.mock.calls.length;

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shm-size",
        job: ["test-job"],
    }, writeStreams);

    const newCalls = bashSpy.mock.calls.slice(callsBefore).map((c: any[]) => c[0]);
    const shmCalls = newCalls.filter((cmd: string) => cmd.includes("--shm-size"));
    expect(shmCalls.length).toBe(0);
});

test("shm-size <service-job> --shm-size=1g", async () => {
    const bashSpy = initBashSpy([]);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/shm-size",
        job: ["service-job"],
        shmSize: "1g",
    }, writeStreams, jobs);

    const bashCalls = bashSpy.mock.calls.map((c: any[]) => c[0]);
    const shmCalls = bashCalls.filter((cmd: string) => cmd.includes("--shm-size=1g"));
    expect(shmCalls.length).toBeGreaterThanOrEqual(2);
});
