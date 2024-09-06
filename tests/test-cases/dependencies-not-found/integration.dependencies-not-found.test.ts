import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert, {AssertionError} from "assert";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("dependencies-not-found <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/dependencies-not-found",
            job: ["test-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`dependencies: [{blueBright invalid}] for {blueBright test-job} cannot be found`);
    }
});
