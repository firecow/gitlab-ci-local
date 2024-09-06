import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

jest.setTimeout(60000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("dind-no-tls <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/dind-no-tls",
        job: ["test-job"],
        needs: true,
        privileged: true,
    }, writeStreams);

    const expectedStdout = [
        chalk`{blueBright test-job} {greenBright >}  Product License: Community Engine`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expectedStdout));

    const expectedStderr = [
        chalk`{blueBright test-job} {redBright >} [DEPRECATION NOTICE]: API is accessible on http://0.0.0.0:2375 without encryption.`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expectedStderr));
});
