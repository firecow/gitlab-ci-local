import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("list-environment --list", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-environment/",
        list: true,
        stateDir: ".gitlab-ci-local-list-environment",
    }, writeStreams);

    // jobNamePad=10 (deploy-job), descriptionPadEnd=11, stagePadEnd=6 (deploy), whenPadEnd=10, environmentPadEnd=11 (max("production","staging")=10 < 11)
    const expected = [
        chalk`{grey ${"name".padEnd(10)}  ${"description".padEnd(11)}}  {grey ${"stage".padEnd(6)}  ${"when".padEnd(10)}}  {grey allow_failure  ${"environment".padEnd(11)}  needs}`,
        chalk`{blueBright ${"test-job".padEnd(10)}}  ${"".padEnd(11)}  {yellow ${"test".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"false".padEnd(13)}  ${"".padEnd(11)}`,
        chalk`{blueBright ${"build-job".padEnd(10)}}  ${"".padEnd(11)}  {yellow ${"build".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"false".padEnd(13)}  ${"staging".padEnd(11)}  [{blueBright test-job}]`,
        // This line depends on PR #1833 (workflow:rules:variables) - without it, $DEPLOY_ENV is not resolved to "production"
        chalk`{blueBright ${"deploy-job".padEnd(10)}}  ${"".padEnd(11)}  {yellow ${"deploy".padEnd(6)}}  ${"on_success".padEnd(10)}  ${"false".padEnd(13)}  ${"production".padEnd(11)}  [{blueBright build-job}]`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("list-environment --list-csv", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/list-environment/",
        listCsv: true,
        stateDir: ".gitlab-ci-local-list-environment-csv",
    }, writeStreams);

    const expected = [
        "name;stage;when;allowFailure;environment;needs",
        "test-job;test;on_success;false;;",
        "build-job;build;on_success;false;staging;[test-job]",
        // This line depends on PR #1833 (workflow:rules:variables) - without it, $DEPLOY_ENV is not resolved to "production"
        "deploy-job;deploy;on_success;false;production;[build-job]",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
