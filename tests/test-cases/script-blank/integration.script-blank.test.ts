import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("script-blank <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await expect(handler({
        cwd: "tests/test-cases/script-blank",
        job: ["test-job"],
        enableJsonSchemaValidation: false,
    }, writeStreams)).rejects.toThrow(chalk`{blue test-job} has empty script`);
});
