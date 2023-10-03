import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

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