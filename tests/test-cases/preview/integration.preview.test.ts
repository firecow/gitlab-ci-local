import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("preview", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/preview",
        preview: true,
    }, writeStreams);

    const expected = [
        chalk`child-job:\n  script:\n    - echo \"Irrelevant\"\n  before_script:\n    - echo \"Default before script\"\nstages:\n  - .pre\n  - build\n  - test\n  - deploy\n  - .post`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
    expect(writeStreams.stderrLines.length).toBe(0);
});
