import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("script-blank <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await expect(handler({
        cwd: "tests/test-cases/script-blank",
        job: ["test-job"],
    }, writeStreams)).rejects.toThrow(chalk`{blue test-job} has empty script`);
});
