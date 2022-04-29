import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";
import chalk from "chalk";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("cache-shell-fail <consume-cache> --shell-isolation --needs", async () => {
    const writeStreams = new MockWriteStreams();
    await expect(handler({
        cwd: "tests/test-cases/cache-paths-not-array",
        job: ["test-job"],
        shellIsolation: true,
    }, writeStreams)).rejects.toThrow(chalk`{blue test-job} cache[0].paths must be array`);
});
