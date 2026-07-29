import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk-template";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("needs-empty-entry <dev-job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await expect(handler({
        cwd: "tests/test-cases/needs-empty-entry",
        stateDir: ".gitlab-ci-local-needs-empty-entry",
    }, writeStreams)).rejects.toThrow(chalk`{blueBright dev-job} {yellow needs:} entries cannot be empty`);
});
