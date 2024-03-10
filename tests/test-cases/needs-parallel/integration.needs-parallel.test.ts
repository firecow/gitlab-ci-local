import {WriteStreamsMock} from "../../../src/write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-parallel <build-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel",
        job: ["build-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job  } {greenBright >} Pre something`,
        chalk`{blueBright build-job} {greenBright >} Build something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("needs-parallel <deploy-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel",
        job: ["deploy-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} Pre something`,
        chalk`{blueBright build-job } {greenBright >} Build something`,
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/Pre something/) !== null;
    });
    expect(found.length).toEqual(2);
});

test("needs-parallel", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-parallel",
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job   } {greenBright >} Pre something`,
        chalk`{blueBright build-job } {greenBright >} Build something`,
        chalk`{blueBright test-job  } {greenBright >} Test something`,
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
