import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("reference-infinity <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/reference-infinity",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{red} reference infinity in test-job`,
    ];
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining(expected));
});
