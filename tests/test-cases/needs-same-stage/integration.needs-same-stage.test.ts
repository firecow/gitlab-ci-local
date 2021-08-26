import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("needs-same-stage <test-job> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/needs-same-stage",
        job: ["test-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright build-job} {greenBright >} Build something`,
        chalk`{blueBright test-job } {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
