import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("invalid-variables-null <test-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/invalid-variables-null",
            job: ["test-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright test-job} has invalid variables hash of key value pairs. INVALID=null`);
    }
});
