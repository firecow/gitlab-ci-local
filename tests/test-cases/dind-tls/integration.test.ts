import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

import.meta.jest.setTimeout(60000);

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("dind-tls <test-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/dind-tls",
        job: ["test-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} TestJobDIND`,
        chalk`{blueBright test-job} {greenBright >} Touchme`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
