import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("plain", async () => {
    const writeStream = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/plain",
    }, writeStream);

    expect(writeStream.stdoutLines.length).toEqual(18);
    expect(writeStream.stderrLines.length).toEqual(1);
});

test("plain <notfound>", async () => {
    const mockWriteStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/plain",
            job: "notfound",
        }, mockWriteStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright notfound} could not be found`);
    }
});
