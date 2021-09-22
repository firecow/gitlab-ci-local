import {MockWriteStreams} from "../src/mock-write-streams";
import chalk from "chalk";
import {handler} from "../src/handler";
import {assert} from "../src/asserts";

test("--completion", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation();
    const writeStreams = new MockWriteStreams();
    await handler({
        completion: true,
    }, writeStreams);
    expect(console.log).toHaveBeenCalledTimes(1);
    spy.mockRestore();
});

test("something/unknown-directory (non-existing dir)", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "something/unknown-directory",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe(chalk`something/unknown-directory is not a directory`);
    }
});

test("docs (no .gitlab-ci.yml)", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "docs",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe(chalk`docs does not contain .gitlab-ci.yml`);
    }
});
