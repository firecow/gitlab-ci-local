import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import {basename} from "node:path/posix";
import {dirname} from "node:path";

const name = basename(dirname(import.meta.url));
const cwd = `tests/test-cases/${name}`;

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

it("should not hang the program", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({cwd, noColor: true}, writeStreams)).rejects.toThrow("This GitLab CI configuration is invalid: The pipeline has circular dependencies: self-dependency: job.");
});
