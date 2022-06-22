import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {assert} from "../../../src/asserts";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("include-infinite", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/include-infinite",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e) {
        assert(e instanceof Error, "e is not instanceof Error");
        expect(e.message).toBe("circular dependency detected in `include`");
    }
});
