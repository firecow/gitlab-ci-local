import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("artifacts-globstar <test-job> --needs --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-globstar",
        job: ["test-job"],
        needs: true,
        shellIsolation: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Pre something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("artifacts-globstar <no-match> --shell-isolation", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/artifacts-globstar",
        job: ["no-match"],
        shellIsolation: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright no-match} {yellow !! no artifacts was copied !!}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
