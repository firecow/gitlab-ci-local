import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-contains-dependencies <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/needs-contains-dependencies",
            job: ["test-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`{blueBright test-job} needs: 'one,three' doesn't fully contain dependencies: 'one,two'`);
    }
});
