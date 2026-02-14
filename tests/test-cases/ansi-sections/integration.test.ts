import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("ansi-sections <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/ansi-sections",
        job: ["test-job"],
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining([
        chalk`{blueBright test-job} {cyanBright #my_section_started}`,
        chalk`{blueBright test-job} {greenBright >} inside section`,
    ]));
    const sectionEnd = writeStreams.stdoutLines.find((l: string) => l.includes("#my_section") && l.includes("took"));
    expect(sectionEnd).toMatch(/took \d+ms/);
});
