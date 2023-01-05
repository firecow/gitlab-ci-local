import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("rules-when test=true", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/rules",
        variables: {TEST: true},
        listCsv: true,
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("test-job;\"\";build;on_success;false;[]");
});

test("rules-when test=undefined", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/rules",
        listCsv: true,
    }, writeStreams);

    const output = writeStreams.stdoutLines.join("\n");
    expect(output).toContain("test-job;\"\";build;manual;false;[]");
});
