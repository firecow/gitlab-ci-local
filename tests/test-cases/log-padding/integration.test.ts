import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const pipelineDirectory = "tests/test-cases/log-padding";

async function verifyLogs ({maxJobNamePadding, expectedJobNamePadding}: {maxJobNamePadding?: number; expectedJobNamePadding: number}) {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        maxJobNamePadding,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{blueBright short-name${" ".repeat(expectedJobNamePadding)}} {greenBright >} short-name\n`,
    );
    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{blueBright my-job-with-a-very-long-long-long-long-name} {greenBright >} long-name\n`,
    );
}

test.concurrent("logs - maxJobNamePadding set to 0", async () => {
    await verifyLogs({maxJobNamePadding: 0, expectedJobNamePadding: 0});
});

test("logs - maxJobNamePadding set to 30", async () => {
    await verifyLogs({maxJobNamePadding: 30, expectedJobNamePadding: 20});
});

test("logs - maxJobNamePadding unset", async () => {
    await verifyLogs({maxJobNamePadding: undefined, expectedJobNamePadding: 33});
});

test("logs - maxJobNamePadding set to 100", async () => {
    await verifyLogs({maxJobNamePadding: 100, expectedJobNamePadding: 33});
});

test("logs - log padding should only take needs and targeted jobs into account", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        needs: true,
        job: ["short-name with needs"],
        stateDir: ".gitlab-ci-local-logs-maxjobnamepadding-set-to-0",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{blueBright short-name with needs         } {greenBright >} short-name with needs\n`,
    );
});

test.concurrent("logs - log padding should only take targeted jobs into account", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        needs: true,
        job: ["short-name"],
        stateDir: ".gitlab-ci-local-logs-log-padding-should-only-take-targeted-jobs-in",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{blueBright short-name} {greenBright >} short-name\n`,
    );
});
