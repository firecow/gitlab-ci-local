import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-paths-not-array <test-job> --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({
        cwd: "tests/test-cases/cache-paths-not-array",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams)).rejects.toThrow(chalk`{blue test-job} cache[0].paths must be array`);
});
