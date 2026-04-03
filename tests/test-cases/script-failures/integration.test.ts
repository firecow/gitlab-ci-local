import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("script-failures <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["test-job"],
        stateDir: ".gitlab-ci-local-script-failures-test-job",
    }, writeStreams);

    const expected = [
        chalk`{black.bgRed  FAIL } {blueBright test-job}`,
        chalk`  {red >} Test something`,
        chalk`  {red >} That fails`,
        chalk`  {red >} Something in the log`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("script-failures <test-job-after-script>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["test-job-after-script"],
        stateDir: ".gitlab-ci-local-script-failures-test-job-after-script",
    }, writeStreams);

    const expected = [
        chalk`{black.bgYellowBright  WARN } {blueBright test-job-after-script}  after_script`,
        chalk`{black.bgRed  FAIL } {blueBright test-job-after-script}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("script-failures <allow-failure-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["allow-failure-job"],
        stateDir: ".gitlab-ci-local-script-failures-allow-failure-job",
    }, writeStreams);

    const expected = [
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-job}  pre_script`,
        chalk`  {yellow >} This is printed right before the failure`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("script-failures <allow-failure-after-script>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["allow-failure-after-script"],
        stateDir: ".gitlab-ci-local-script-failures-allow-failure-after-script",
    }, writeStreams);

    const expected = [
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-after-script}  pre_script`,
        chalk`{black.bgYellowBright  WARN } {blueBright allow-failure-after-script}  after_script`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("script-failures <deploy-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["deploy-job"],
        needs: true,
        stateDir: ".gitlab-ci-local-script-failures-deploy-job-needs",
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

test.concurrent("script-failures <exit_code[number] allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number] allowed"],
        stateDir: ".gitlab-ci-local-script-failures-exit-code-number-allowed",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgYellowBright  WARN } {blueBright exit_code[number] allowed}  pre_script`,
    );
});

test.concurrent("script-failures <exit_code[number[]] allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number[]] allowed"],
        stateDir: ".gitlab-ci-local-script-failures-exit-code-number-array-allowed",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgYellowBright  WARN } {blueBright exit_code[number[]] allowed}  pre_script`,
    );
});

test.concurrent("script-failures <exit_code[number] not allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number] not allowed"],
        stateDir: ".gitlab-ci-local-script-failures-exit-code-number-not-allowed",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgRed  FAIL } {blueBright exit_code[number] not allowed}`,
    );
});

test.concurrent("script-failures <exit_code[number[]] not allowed>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["exit_code[number[]] not allowed"],
        stateDir: ".gitlab-ci-local-script-failures-exit-code-number-array-not-allowed",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgRed  FAIL } {blueBright exit_code[number[]] not allowed}`,
    );
});

test.concurrent("script-failures <rules:allow_failure precedence>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["rules:allow_failure precedence"],
        stateDir: ".gitlab-ci-local-script-failures-rules-allow-failure-precedence",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgRed  FAIL } {blueBright rules:allow_failure precedence}`,
    );
});

test.concurrent("script-failures <rules:without allow_failure>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/script-failures",
        job: ["rules:without allow_failure"],
        stateDir: ".gitlab-ci-local-script-failures-rules-without-allow-failure",
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toContain(
        chalk`{black.bgYellowBright  WARN } {blueBright rules:without allow_failure}`,
    );
});
