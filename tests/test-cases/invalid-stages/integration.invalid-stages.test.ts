import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("invalid-stages", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/invalid-stages",
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{yellow stages:} must be an array`);
    }
});
