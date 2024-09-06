import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("invalid-stages", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/invalid-stages",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{yellow stages:} must be an array`);
    }
});
