import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-dotenv <use-image-ref> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-dotenv",
        job: ["use-image-ref"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});

test("artifacts-dotenv <use-service-ref> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-dotenv",
        job: ["use-service-ref"],
        needs: true,
    }, writeStreams);

    expect(writeStreams.stderrLines.join("\n")).not.toMatch(/FAIL/);
});
