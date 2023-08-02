import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("--concurrency 1 - should run sequentially", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/concurrency",
        concurrency: 1,
    }, writeStreams);

    // tip: use `cat __snapshots__/*` to inspect the results
    expect(writeStreams.stdoutLines.join("\n").replace(/[0-9.]+ m?s/g, "1 ms")).toMatchSnapshot();
});

test("--concurrency not set", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/concurrency",
    }, writeStreams);

    expect(writeStreams.stderrLines.length).toEqual(2);
});
