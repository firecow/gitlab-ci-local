import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("script-failures <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgRed  FAIL } {blueBright test-job}`,
        chalk`  {red >} Test something`,
        chalk`  {red >} That fails`,
        chalk`  {red >} Something in the log`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <test-job-after-script>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["test-job-after-script"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgYellowBright  WARN } {blueBright test-job-after-script}  after_script`,
        chalk`{black.bgRed  FAIL } {blueBright test-job-after-script}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <allow-failure-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["allow-failure-job"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-job}  pre_script`,
        chalk`  {yellow >} This is printed right before the failure`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <allow-failure-after-script>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["allow-failure-after-script"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-after-script}  pre_script`,
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-after-script}  after_script`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("script-failures <deploy-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["deploy-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job  } {greenBright >} Test something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.find((l) => {
        return l.match(/Deploy something/) !== null;
    });
    expect(found).toEqual(undefined);
});

test("script-failures <exit_code[number] allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number] allowed"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgYellowBright  WARN } {blueBright exit_code[number] allowed}  pre_script`,
    );
});

test("script-failures <exit_code[number[]] allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number[]] allowed"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgYellowBright  WARN } {blueBright exit_code[number[]] allowed}  pre_script`,
    );
});

test("script-failures <exit_code[number] not allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number] not allowed"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgRed  FAIL } {blueBright exit_code[number] not allowed}`,
    );
});

test("script-failures <exit_code[number[]] not allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number[]] not allowed"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgRed  FAIL } {blueBright exit_code[number[]] not allowed}`,
    );
});

test("script-failures <rules:allow_failure precedence>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["rules:allow_failure precedence"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgRed  FAIL } {blueBright rules:allow_failure precedence}`,
    );
});

test("script-failures <rules:without allow_failure>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["rules:without allow_failure"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgYellowBright  WARN } {blueBright rules:without allow_failure}`,
    );
});
