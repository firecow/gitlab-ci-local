import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

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

    for (let i = 1; i <= 11; i ++) {
        expect(writeStreams.stdoutLines[i * 3]).toEqual(chalk`{blueBright build-job} {greenBright >} ${i}`);
    }
});
