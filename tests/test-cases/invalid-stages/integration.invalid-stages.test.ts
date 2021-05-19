import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("invalid-stages", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/invalid-stages",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        expect(e.message).toBe(chalk`{yellow stages:} must be an array`);
    }
});
