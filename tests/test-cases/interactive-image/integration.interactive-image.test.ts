import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {assert} from "../../../src/asserts";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("interactive-image <image-job>", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/interactive-image",
            job: ["image-job"],
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toEqual(chalk`{blueBright image-job} @Interactive decorator cannot have image: and must be when:manual`);
    }
});
