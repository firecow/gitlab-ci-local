import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("stage-not-found <test-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/stage-not-found",
            job: "test-job"
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{yellow stage:invalid} not found for {blueBright test-job}`);
    }
});
