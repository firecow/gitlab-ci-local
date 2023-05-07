import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const pipelineDirectory = "tests/test-cases/logPadding";

async function verifyLogs ({maxJobNameLength}: {maxJobNameLength?: number}) {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        job: ["short-name"],
        maxJobNameLength,
    }, writeStreams);

    // tip: use `cat __snapshots__/*` to inspect the results
    expect(writeStreams.stdoutLines.join("\n").replace(/[0-9.]+ ms/g, "1 ms")).toMatchSnapshot();
}

test("logs - maxJobNameLength set to 0", async () => {
    await verifyLogs({maxJobNameLength: 0});
});

test("logs - maxJobNameLength set to 30", async () => {
    await verifyLogs({maxJobNameLength: 30});
});

test("logs - maxJobNameLength unset", async () => {
    await verifyLogs({maxJobNameLength: undefined});
});