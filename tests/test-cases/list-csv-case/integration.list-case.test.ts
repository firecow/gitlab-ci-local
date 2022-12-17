import {WriteStreamsMock} from "../../../src/write-streams-mock";
import {handler} from "../../../src/handler";
import {initSpawnSpy} from "../../mocks/utils.mock";
import {WhenStatics} from "../../mocks/when-statics";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("list-csv-case --list-csv", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        listCsv: true,
    }, writeStreams);

    const expected = [
        "name;description;stage;when;allowFailure;needs",
        "test-job;Run Tests;test;on_success;false;[]",
        "build-job;;build;on_success;true;[test-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});


test("list-csv-case --list-csv colon should add placeholder", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        file: ".gitlab-ci-description-colon.yml",
        listCsv: true,
    }, writeStreams);

    const expected = [
        "name;description;stage;when;allowFailure;needs",
        "test-job;semicolon in description detected;test;on_success;false;[]",
        "build-job;;build;on_success;true;[test-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("list-csv-case --list-csv colon should add placeholder", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        file: ".gitlab-ci-description-colon.yml",
        listCsv: true,
    }, writeStreams);

    const expected = [
        "name;description;stage;when;allowFailure;needs",
        "test-job;semicolon in description detected;test;on_success;false;[]",
        "build-job;;build;on_success;true;[test-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

