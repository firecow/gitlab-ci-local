import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const pipelineDirectory = "tests/test-cases/log-padding";

async function verifyLogs ({maxJobNamePadding}: {maxJobNamePadding?: number}) {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        job: ["short-name"],
        maxJobNamePadding,
    }, writeStreams);

    // tip: use `cat __snapshots__/*` to inspect the results
    expect(writeStreams.stdoutLines.join("\n").replace(/[0-9.]+ ms/g, "1 ms")).toMatchSnapshot();
}

test("logs - maxJobNamePadding set to 0", async () => {
    await verifyLogs({maxJobNamePadding: 0});
});

test("logs - maxJobNamePadding set to 30", async () => {
    await verifyLogs({maxJobNamePadding: 30});
});

test("logs - maxJobNamePadding unset", async () => {
    await verifyLogs({maxJobNamePadding: undefined});
});