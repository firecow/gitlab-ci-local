import {MockWriteStreams} from "../src/mock-write-streams";
import * as chalk from "chalk";
import {handler} from "../src/handler";

test("something/unknown-directory (non-existing dir)", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "something/unknown-directory",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`something/unknown-directory is not a directory`);
    }
});

test("docs (no .gitlab-ci.yml)", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "docs",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`docs does not contain .gitlab-ci.yml`);
    }
});
