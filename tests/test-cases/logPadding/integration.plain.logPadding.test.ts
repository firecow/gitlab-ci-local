import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const pipelineDirectory = "tests/test-cases/logPadding";

// tip: just `cat __snapshots__/*` to inspect the results

test("logs - maxJobNameLength set to 0", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        job: ["short-name"],
        maxJobNameLength: 0,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatchSnapshot();
});

test("logs - maxJobNameLength set to 30", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        job: ["short-name"],
        maxJobNameLength: 30,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatchSnapshot();
});

test("logs - maxJobNameLength unset", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        job: ["short-name"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatchSnapshot();
});