import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initBashSpy, initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {cleanupJobResources, Job} from "../../../src/job.js";
import {
    GitlabRunnerCPUsPresetValue,
    GitlabRunnerMemoryPresetValue,
    GitlabRunnerPresetValues,
} from "../../../src/gitlab-preset.js";

let jobs: Job[] = [];
beforeAll(() => {
    initSpawnSpy([...WhenStatics.all, {
        cmdArgs: ["docker", "cp", expect.any(String), expect.any(String)],
        returnValue: {stdout: "Ok"},
    }]);
});

beforeEach(async () => {
    jobs = [];
});

afterEach(async () => {
    await cleanupJobResources(jobs);
    initBashSpy([]);
});

test("--container-emulate some_unexisting_runner", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/container-executable",
            containerEmulate: "some_unexisting_runner",
        }, writeStreams, jobs);

        expect(true).toBe(false);
    } catch (e: unknown) {
        expect((e as Error).message).toContain("Invalid gitlab runner to emulate.");
    }
});

test("should contains memory config when emulating valid runner", async () => {
    // given a spy of the bash utils
    const bashSpy = initBashSpy([{cmd: expect.any(String), returnValue: {stdout: "abcde12345", stderr: "", exitCode: 0}}]);

    // and a WriteStreamsMock
    const writeStreams = new WriteStreamsMock();

    // when calling the handler with a valid emulate value
    await handler({
        cwd: "tests/test-cases/container-executable",
        containerEmulate: "saas-linux-small",
    }, writeStreams);

    // then the bash spy should have been called with the memory option
    expect(bashSpy).toHaveBeenLastCalledWith(expect.stringMatching(/ --memory=\d{1,6}m /), expect.any(String));
});

test("should contains kernel memory config when emulating valid runner", async () => {
    // given a spy of the bash utils
    const bashSpy = initBashSpy([{cmd: expect.any(String), returnValue: {stdout: "abcde12345", stderr: "", exitCode: 0}}]);

    // and a WriteStreamsMock
    const writeStreams = new WriteStreamsMock();

    // when calling the handler with a valid emulate value
    await handler({
        cwd: "tests/test-cases/container-executable",
        containerEmulate: "saas-linux-small",
    }, writeStreams);

    // then the bash spy should have been called with the kernel option
    expect(bashSpy).toHaveBeenLastCalledWith(expect.stringMatching(/ --kernel-memory=\d{1,6}m /), expect.any(String));
});

test("should contains cpus config when emulating valid runner", async () => {
    // given a spy of the bash utils
    const bashSpy = initBashSpy([{cmd: expect.any(String), returnValue: {stdout: "abcde12345", stderr: "", exitCode: 0}}]);

    // and a WriteStreamsMock
    const writeStreams = new WriteStreamsMock();

    // when calling the handler with a valid emulate value
    await handler({
        cwd: "tests/test-cases/container-executable",
        containerEmulate: "saas-linux-small",
    }, writeStreams);

    // then the bash spy should have been called with the cpus option
    expect(bashSpy).toHaveBeenLastCalledWith(expect.stringMatching(/ --cpus=\d{1,3}(\.\d{1,3})? /), expect.any(String));
});

const gitlabRunnerDataProvider = GitlabRunnerPresetValues.map(name => ({
    name,
    memory: GitlabRunnerMemoryPresetValue[name],
    cpus: GitlabRunnerCPUsPresetValue[name],
}));

describe.each(gitlabRunnerDataProvider)("gitlab runner configuration", (data) => {
    test(`should set the proper values when emulating ${data.name}`, async () => {
        // given a spy of the bash utils
        const bashSpy = initBashSpy([{cmd: expect.any(String), returnValue: {stdout: "abcde12345", stderr: "", exitCode: 0}}]);

        // and a WriteStreamsMock
        const writeStreams = new WriteStreamsMock();

        // when calling the handler with the given emulated runner
        await handler({
            cwd: "tests/test-cases/container-executable",
            containerEmulate: data.name,
        }, writeStreams);

        // then the bash spy should have been called with the memory option
        expect(bashSpy).toHaveBeenLastCalledWith(expect.stringContaining(`--memory=${data.memory}`), expect.any(String));

        // and the bash spy should have been called with the kernel memory option
        expect(bashSpy).toHaveBeenLastCalledWith(expect.stringContaining(`--kernel-memory=${data.memory}`), expect.any(String));

        // and the bash spy should have been called with the cpus option
        expect(bashSpy).toHaveBeenLastCalledWith(expect.stringContaining(`--cpus=${data.cpus}`), expect.any(String));
    });
});
