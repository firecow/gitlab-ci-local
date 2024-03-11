import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

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
