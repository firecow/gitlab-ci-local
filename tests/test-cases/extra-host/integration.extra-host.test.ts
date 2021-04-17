import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("add-host <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    await handler({
        cwd: "tests/test-cases/extra-host",
        job: "test-job",
        extraHost: ["fake-google.com:142.250.185.206"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} HTTP/1.1 404 Not Found`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
