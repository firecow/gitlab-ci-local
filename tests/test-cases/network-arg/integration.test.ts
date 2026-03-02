import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Job, cleanupJobResources} from "../../../src/job.js";
import chalk from "chalk-template";
import {initSpawnSpy, initBashSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert from "assert";
import {AssertionError} from "assert";

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

test("network-host <test-job>", async () => {
    const bashSpy = initBashSpy([]);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["test-job"],
        network: ["host"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--network host/), expect.any(String));
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("network-host <service-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/network-arg",
            job: ["service-job"],
            network: ["host"],
        }, writeStreams, jobs);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`Cannot add service network alias with network mode 'host'`);
    }
});

test("network-none <test-job>", async () => {
    const bashSpy = initBashSpy([]);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["test-job"],
        network: ["none"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--network none/), expect.any(String));
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("network-none <service-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/network-arg",
            job: ["service-job"],
            network: ["none"],
        }, writeStreams, jobs);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`Cannot add service network alias with network mode 'none'`);
    }
});

test("network-custom <test-job>", async () => {
    const bashSpy = initBashSpy([]);
    const networkSpy = initSpawnSpy([{
        cmdArgs: expect.arrayContaining(["docker", "network", "connect"]),
        returnValue: {stdout: "", stderr: "", exitCode: 0},
    }]);

    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["test-job"],
        network: ["host", "custom-network1", "custom-network2"],
    }, writeStreams);

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--network host/), expect.any(String));
    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network1"]));
    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network2"]));
});

test("network-custom <service-job>", async () => {
    const networkSpy = initSpawnSpy([{
        cmdArgs: expect.arrayContaining(["docker", "network", "connect"]),
        returnValue: {stdout: "", stderr: "", exitCode: 0},
    }]);

    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["service-job"],
        network: ["custom-network1", "custom-network2"],
    }, writeStreams);

    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network1"]));
    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network2"]));
});
