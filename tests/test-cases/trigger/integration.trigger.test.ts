import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("trigger", async () => {
    const mockWriteStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/trigger",
    }, mockWriteStreams);

    const expected = [chalk`{green successful} {blueBright pipe-gen-job}, {blueBright trigger_job}`];
    expect(mockWriteStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
