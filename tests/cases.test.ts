import {WriteStreamsMock} from "../src/write-streams-mock";
import chalk from "chalk";
import {handler} from "../src/handler";
import assert from "assert";
import {AssertionError} from "assert";

test("--completion", async () => {
    const spy = jest.spyOn(console, "log").mockImplementation();
    const writeStreams = new WriteStreamsMock();
    await handler({
        completion: true,
    }, writeStreams);
    expect(console.log).toHaveBeenCalledTimes(1);
    spy.mockRestore();
});

test("something/unknown-directory (non-existing dir)", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "something/unknown-directory",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`something/unknown-directory is not a directory`);
    }
});

test("docs (no .gitlab-ci.yml)", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "docs",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`docs/.gitlab-ci.yml could not be found`);
    }
});
