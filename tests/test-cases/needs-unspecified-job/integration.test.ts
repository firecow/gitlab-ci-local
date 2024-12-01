import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import assert, {AssertionError} from "assert";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-unspecified-job <build-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    try {
        await handler({
            cwd: "tests/test-cases/needs-unspecified-job",
            job: ["test-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toBe(chalk`needs: [{blueBright invalid}] for {blueBright test-job} could not be found`);
    }
});
