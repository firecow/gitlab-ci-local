import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk-template";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("rules-blank <job>", async () => {
    const writeStreams = new WriteStreamsMock();

    await expect(handler({
        cwd: "tests/test-cases/rules-blank",
        stateDir: ".gitlab-ci-local-rules-blank",
    }, writeStreams)).rejects.toThrow(chalk`{blue job} {yellow rules:} config can't be blank`);
});
