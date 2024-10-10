import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("needs-sequence <deploy-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-sequence",
        job: ["deploy-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright deploy-job} {greenBright >} Deploy something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/Pre something/) !== null;
    });
    expect(found.length).toEqual(0);
});

test("needs-sequence <deploy-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-sequence",
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
    expect(writeStreams.stderrLines).toEqual(expect.arrayContaining([
        chalk`{yellow premium-job.needs[0] ignored, project key not supported}`,
    ]));

    const found = writeStreams.stdoutLines.filter((l) => {
        return l.match(/NoNeeds something/) !== null;
    });
    expect(found.length).toEqual(0);
});

test("needs-sequence <no-needs-job> --needs", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-sequence",
        job: ["no-needs-job"],
        needs: true,
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job     } {greenBright >} Pre something`,
        chalk`{blueBright build-job   } {greenBright >} Build something`,
        chalk`{blueBright no-needs-job} {greenBright >} NoNeeds something`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    const foundTest = writeStreams.stdoutLines.filter((l) => {
        return l.match(/Test something/) !== null;
    });
    expect(foundTest.length).toEqual(0);

    const foundDeploy = writeStreams.stdoutLines.filter((l) => {
        return l.match(/Deploy something/) !== null;
    });
    expect(foundDeploy.length).toEqual(0);
});

test("needs-sequence", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/needs-sequence",
    }, writeStreams);

    const expected = [
        chalk`{blueBright pre-job     } {greenBright >} Pre something`,
        chalk`{blueBright build-job   } {greenBright >} Build something`,
        chalk`{blueBright test-job    } {greenBright >} Test something`,
        chalk`{blueBright no-needs-job} {greenBright >} NoNeeds something`,
        chalk`{blueBright deploy-job  } {greenBright >} Deploy something`,
        chalk`{blueBright premium-job } {greenBright >} I'm utilizing premium feature`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
