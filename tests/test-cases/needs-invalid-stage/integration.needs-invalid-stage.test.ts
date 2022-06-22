import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {assert} from "../../../src/asserts";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-invalid-stage <build-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/needs-invalid-stage",
            job: ["build-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe(chalk`{blueBright test-job} is needed by {blueBright build-job}, but it is in a future stage`);
    }
});
