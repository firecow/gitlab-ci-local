import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});


test("duplicated-keys <duplicated-keys>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/duplicated-keys",
        job: ["duplicated-keys"],
    }, writeStreams);

    const expected = [
        chalk`\n{blueBright duplicated-keys} {green $ echo \"$FOO\"}`,
        chalk`{blueBright duplicated-keys} {greenBright >} `,
        chalk`{blueBright duplicated-keys} {green $ echo \"$BAR\"}`,
        chalk`{blueBright duplicated-keys} {greenBright >} 2`,
    ];


    expect(writeStreams.stdoutLines.join("\n")).toContain(expected.join("\n"));
});

test("duplicated-keys <duplicated-keys variables overwritten>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/duplicated-keys",
        job: ["duplicated-keys variables overwritten"],
    }, writeStreams);

    const expected = [
        chalk`\n{blueBright duplicated-keys variables overwritten} {green $ echo \"$FOO\"}`,
        chalk`{blueBright duplicated-keys variables overwritten} {greenBright >} `,
        chalk`{blueBright duplicated-keys variables overwritten} {green $ echo \"$BAR\"}`,
        chalk`{blueBright duplicated-keys variables overwritten} {greenBright >} 2`,
    ];


    expect(writeStreams.stdoutLines.join("\n")).toContain(expected.join("\n"));
});

test("duplicated-keys <duplicated-keys anchor tag can still be referenced>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/duplicated-keys",
        job: ["duplicated-keys anchor tag can still be referenced"],
    }, writeStreams);

    const expected = [
        chalk`\n{blueBright duplicated-keys anchor tag can still be referenced} {green $ echo \"$FOO\"}`,
        chalk`{blueBright duplicated-keys anchor tag can still be referenced} {greenBright >} 1`,
        chalk`{blueBright duplicated-keys anchor tag can still be referenced} {green $ echo \"$BAR\"}`,
        chalk`{blueBright duplicated-keys anchor tag can still be referenced} {greenBright >} 2`,
    ];


    expect(writeStreams.stdoutLines.join("\n")).toContain(expected.join("\n"));
});
