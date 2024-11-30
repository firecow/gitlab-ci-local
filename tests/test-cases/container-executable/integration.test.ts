import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("--container-executable some_unexisting_executable", async () => {
    try {
        const writeStreams = new WriteStreamsMock();
        await handler({
            cwd: "tests/test-cases/container-executable",
            containerExecutable: "some_unexisting_executable",
        }, writeStreams);
        expect(true).toBe(false);
    } catch (e: unknown) {
        expect((e as Error).message).toEqual(expect.stringContaining("Command failed with ENOENT: some_unexisting_executable"));
    }
});