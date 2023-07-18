import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-sequence artifacts copied to next stages", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-sequence",
        shellIsolation: true,
    }, writeStreams);
});

test("artifacts-sequence parallel matrix artifacts copied to next stages", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-sequence",
        file: ".gitlab-ci-parallel.yml",
        shellIsolation: true,
    }, writeStreams);
});
