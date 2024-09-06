import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

jest.setTimeout(13000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("long-running-silent-build-job <build-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/long-running-silent-build-job",
        job: ["build-job"],
    }, writeStreams);

    let expected = "";
    for (let i = 1; i <= 11; i ++) {
        expected += chalk`
{blueBright build-job} {green $ sleep 1}
{blueBright build-job} {green $ echo ${i}}
{blueBright build-job} {greenBright >} ${i}`;
    }

    expect(writeStreams.stdoutLines.join("\n")).toContain(expected);
});
