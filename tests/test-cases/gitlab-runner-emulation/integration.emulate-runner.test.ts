import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {Utils} from "../../../src/utils";
import {
    GitlabRunnerCPUsPresetValue,
    GitlabRunnerMemoryPresetValue,
    GitlabRunnerPresetValues,
} from "../../../src/gitlab-preset";

beforeAll(() => {
    initSpawnSpy([...WhenStatics.all, {
        cmdArgs: ["docker", "cp", expect.any(String), expect.any(String)],
        returnValue: {stdout: "Ok"},
    }]);
});

test("--emulate some_unexisting_runner", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/container-executable",
            emulate: "some_unexisting_runner",
        }, writeStreams);

        expect(true).toBe(false);
    } catch (e: unknown) {
        expect((e as Error).message).toContain("Invalid gitlab runner to emulate.");
    }
});

test("should contains memory config when emulating valid runner", async () => {
    // given a spy of the bash utils
    const bashSpy = jest.spyOn(Utils, "bash").mockResolvedValue({stdout: "abcde12345", stderr: "", exitCode: 0});

    // and a WriteStreamsMock
    const writeStreams = new WriteStreamsMock();

    // when calling the handler with a valid emulate value
    await handler({
        cwd: "tests/test-cases/container-executable",
        emulate: "saas-linux-small-amd64",
    }, writeStreams);

    // then the bash spy should have been called with the memory option
    expect(bashSpy).toHaveBeenLastCalledWith(expect.stringMatching(/ --memory=\d{1,6}m /), expect.any(String));
});

test("should contains kernel memory config when emulating valid runner", async () => {
    // given a spy of the bash utils
    const bashSpy = jest.spyOn(Utils, "bash").mockResolvedValue({stdout: "abcde12345", stderr: "", exitCode: 0});

    // and a WriteStreamsMock
    const writeStreams = new WriteStreamsMock();

    // when calling the handler with a valid emulate value
    await handler({
        cwd: "tests/test-cases/container-executable",
        emulate: "saas-linux-small-amd64",
    }, writeStreams);

    // then the bash spy should have been called with the kernel option
    expect(bashSpy).toHaveBeenLastCalledWith(expect.stringMatching(/ --kernel-memory=\d{1,6}m /), expect.any(String));
});

test("should contains cpus config when emulating valid runner", async () => {
    // given a spy of the bash utils
    const bashSpy = jest.spyOn(Utils, "bash").mockResolvedValue({stdout: "abcde12345", stderr: "", exitCode: 0});

    // and a WriteStreamsMock
    const writeStreams = new WriteStreamsMock();

    // when calling the handler with a valid emulate value
    await handler({
        cwd: "tests/test-cases/container-executable",
        emulate: "saas-linux-small-amd64",
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
        const bashSpy = jest.spyOn(Utils, "bash").mockResolvedValue({stdout: "abcde12345", stderr: "", exitCode: 0});

        // and a WriteStreamsMock
        const writeStreams = new WriteStreamsMock();

        // when calling the handler with the given emulated runner
        await handler({
            cwd: "tests/test-cases/container-executable",
            emulate: data.name,
        }, writeStreams);

        // then the bash spy should have been called with the memory option
        expect(bashSpy).toHaveBeenLastCalledWith(expect.stringContaining(`--memory=${data.memory}`), expect.any(String));

        // and the bash spy should have been called with the kernel memory option
        expect(bashSpy).toHaveBeenLastCalledWith(expect.stringContaining(`--kernel-memory=${data.memory}`), expect.any(String));

        // and the bash spy should have been called with the cpus option
        expect(bashSpy).toHaveBeenLastCalledWith(expect.stringContaining(`--cpus=${data.cpus}`), expect.any(String));
    });
});
