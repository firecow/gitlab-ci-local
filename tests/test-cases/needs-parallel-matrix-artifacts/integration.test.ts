import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("needs-parallel-matrix-artifacts cascades only the matching producer's artifacts to each consumer permutation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel-matrix-artifacts",
        shellIsolation: true,
        stateDir: ".gitlab-ci-local-needs-parallel-matrix-artifacts",
    }, writeStreams);

    // Positive: each test permutation reads its own producer's artifact via `cat tag-*.txt`.
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright test: [aws] } {greenBright >} aws-data`,
        chalk`{blueBright test: [gcp] } {greenBright >} gcp-data`,
    ]));

    // Negative: the other matrix permutation's artifact must NOT have leaked into
    // the consumer's working dir. If it did, `cat tag-*.txt` would emit both lines.
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright test: [aws] } {greenBright >} gcp-data`,
    ]));
    expect(writeStreams.stdoutLines).not.toEqual(expect.arrayContaining([
        chalk`{blueBright test: [gcp] } {greenBright >} aws-data`,
    ]));
});
