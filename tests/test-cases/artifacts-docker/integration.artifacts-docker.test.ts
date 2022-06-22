import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-docker <consume artifacts> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-docker",
        job: ["consume artifacts 🏗️"],
        needs: true,
    }, writeStreams);
});
