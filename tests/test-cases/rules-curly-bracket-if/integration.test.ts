import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("rules-curly-bracket-if rejects ${VAR} in rules:if", async () => {
    const writeStreams = new WriteStreamsMock();

    await expect(handler({
        cwd: "tests/test-cases/rules-curly-bracket-if",
        stateDir: ".gitlab-ci-local-rules-curly-bracket-if",
    }, writeStreams)).rejects.toThrow(/rules:rule if invalid expression syntax/);
});
