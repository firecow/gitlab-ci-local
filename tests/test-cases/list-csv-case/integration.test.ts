import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("list-csv-case --list-csv", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        listCsv: true,
        stateDir: ".gitlab-ci-local-list-csv-case-list-csv",
    }, writeStreams);

    const expected = [
        "name;stage;when;allowFailure;needs",
        "test-job;test;on_success;false;",
        "build-job;build;on_success;true;[test-job]",
        "exit-codes-job;build;on_success;[42,137];[]",
        "deploy-job;deploy;on_success;[1];",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});


test.concurrent("list-csv-case --list-csv colon should add process descriptors with semicolons", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        file: ".gitlab-ci-description-colon.yml",
        listCsv: true,
        stateDir: ".gitlab-ci-local-list-csv-case-list-csv-colon-should-add-process-de",
    }, writeStreams);

    const expected = [
        "name;stage;when;allowFailure;needs",
        "test-job;test;on_success;false;",
        "build-job;build;on_success;true;[test-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});


test.concurrent("list-csv-case --list", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-csv-case/",
        list: true,
        stateDir: ".gitlab-ci-local-list-csv-case-list",
    }, writeStreams);

    // jobNamePad=14 (exit-codes-job), descriptionPadEnd=11, stagePadEnd=6 (deploy), whenPadEnd=10
    const expected = [
        chalk`{grey ${"name".padEnd(14)}  ${"description".padEnd(11)}}  {grey ${"stage".padEnd(6)}  ${"when".padEnd(10)}}  {grey allow_failure  needs}`,
        chalk`{blueBright ${"test-job".padEnd(14)}}  ${"Run Tests".padEnd(11)}  {yellow ${"test".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"false".padEnd(11)}`,
        chalk`{blueBright ${"build-job".padEnd(14)}}  ${"".padEnd(11)}  {yellow ${"build".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"true".padEnd(11)}    [{blueBright test-job}]`,
        chalk`{blueBright ${"exit-codes-job".padEnd(14)}}  ${"".padEnd(11)}  {yellow ${"build".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"[42,137]".padEnd(11)}    [{blueBright }]`,
        chalk`{blueBright ${"deploy-job".padEnd(14)}}  ${"".padEnd(11)}  {yellow ${"deploy".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"[1]".padEnd(11)}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
