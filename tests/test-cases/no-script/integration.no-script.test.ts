import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("no-script <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/no-script",
            job: "test-job"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright test-job} must have script specified`);
    }
});
