import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import {AssertionError} from "assert";
import {assert} from "console";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("when", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/when",
        }, writeStreams);
    } catch (e: any) {
        assert(e instanceof AssertionError, "e is not instanceof AssertionError");
        expect(e.message).toContain("This GitLab CI configuration is invalid: jobs:test-job when:never can only be used in a rules section or workflow:rules");
        return;
    }

    throw new Error("Error is expected but not thrown/caught");
});
