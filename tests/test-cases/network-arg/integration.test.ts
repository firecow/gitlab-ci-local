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

test.concurrent("network-host <test-job>", async () => {
    const bashSpy = initBashSpy([]);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["test-job"],
        network: ["host"],
        stateDir: ".gitlab-ci-local-network-host-test-job",
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--network host/), expect.any(String));
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("network-host <service-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/network-arg",
            job: ["service-job"],
            network: ["host"],
            stateDir: ".gitlab-ci-local-network-host-service-job",
        }, writeStreams, jobs);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`Cannot add service network alias with network mode 'host'`);
    }
});

test.concurrent("network-none <test-job>", async () => {
    const bashSpy = initBashSpy([]);

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["test-job"],
        network: ["none"],
        stateDir: ".gitlab-ci-local-network-none-test-job",
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright test-job}`,
    ];

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--network none/), expect.any(String));
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("network-none <service-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/network-arg",
            job: ["service-job"],
            network: ["none"],
            stateDir: ".gitlab-ci-local-network-none-service-job",
        }, writeStreams, jobs);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`Cannot add service network alias with network mode 'none'`);
    }
});

test.concurrent("network-custom <test-job>", async () => {
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
        stateDir: ".gitlab-ci-local-network-custom-test-job",
    }, writeStreams);

    expect(bashSpy).toHaveBeenCalledWith(expect.stringMatching(/--network host/), expect.any(String));
    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network1"]));
    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network2"]));
});

test.concurrent("network-custom <service-job>", async () => {
    const networkSpy = initSpawnSpy([{
        cmdArgs: expect.arrayContaining(["docker", "network", "connect"]),
        returnValue: {stdout: "", stderr: "", exitCode: 0},
    }]);

    const writeStreams = new WriteStreamsMock();

    await handler({
        cwd: "tests/test-cases/network-arg",
        job: ["service-job"],
        network: ["custom-network1", "custom-network2"],
        stateDir: ".gitlab-ci-local-network-custom-service-job",
    }, writeStreams);

    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network1"]));
    expect(networkSpy).toHaveBeenCalledWith(expect.arrayContaining(["docker", "network", "connect", "custom-network2"]));
});
