import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk-template";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("needs-not-array <dev-job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await expect(handler({
        cwd: "tests/test-cases/needs-not-array",
        stateDir: ".gitlab-ci-local-needs-not-array",
    }, writeStreams)).rejects.toThrow(chalk`{blueBright dev-job} {yellow needs:} must be an array`);
});
