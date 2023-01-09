import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

jest.setTimeout(60000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("--umask should use the --user 0:0", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain("Test success! USER-ID=0");
});

test("--no-umask should not use the --user 0:0", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/umask/",
        umask: false,
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain("Test success! USER-ID=185");

});

