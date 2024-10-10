import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

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
        "test-job;\"Run Tests\";test;on_success;false;[]",
        "build-job;\"\";build;on_success;true;[test-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});


test("list-csv-case --list-csv colon should add process descriptors with semicolons", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        file: ".gitlab-ci-description-colon.yml",
        listCsv: true,
    }, writeStreams);

    const expected = [
        "name;description;stage;when;allowFailure;needs",
        "test-job;\"Run;Tests\";test;on_success;false;[]",
        "build-job;\"\";build;on_success;true;[test-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

