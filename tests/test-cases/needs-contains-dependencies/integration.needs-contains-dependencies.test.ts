import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {assert} from "../../../src/asserts";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-contains-dependencies <test-job>", async () => {
    const writeStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/needs-contains-dependencies",
            job: ["test-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe(chalk`{blueBright test-job} needs: 'one,three' doesn't fully contain dependencies: 'one,two'`);
    }
});
