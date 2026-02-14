import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";
import path from "path";

const cwd = "tests/test-cases/project-variables-file";
const emptyFileVariable = "dummy";
beforeAll(() => {
    initSpawnSpy([...WhenStatics.all]);
    fs.createFileSync(path.join(cwd, emptyFileVariable));
});

afterAll(() => {
    fs.removeSync(path.join(cwd, emptyFileVariable));
});

test("project-variables-file <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        job: ["test-job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} Y`,
        chalk`{blueBright test-job} {greenBright >} Recursive CI/CD`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("project-variables-file <issue-1508>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        job: ["issue-1508"],
        variable: ["XDEBUG_MODE=debug,develop"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright issue-1508} {greenBright >} minikube`,
        chalk`{blueBright issue-1508} {greenBright >} /root/.kube/config`,
        chalk`{blueBright issue-1508} {greenBright >} debug,develop`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("project-variables-file <issue-1333>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-issue-1333.yml",
    }, writeStreams);

    const expected = [
        chalk`{blueBright issue-1333} {greenBright >} firecow`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("project-variables-file custom-path", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        variablesFile: ".custom-local-var-file",
        job: ["job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright job} {greenBright >} firecow`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("project-variables-file empty-variable-file", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        variablesFile: emptyFileVariable,
        job: ["job"],
        preview: true,
    }, writeStreams);
    expect(writeStreams.stdoutLines[0]).toEqual(`---
stages:
  - .pre
  - build
  - test
  - deploy
  - .post
job:
  image:
    name: busybox
  script:
    - echo $SECRET
job2:
  image:
    name: busybox
  script:
    - env | grep SECRET | sort`);
});

test("project-variables-file custom-path (.env)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        variablesFile: ".env",
        job: ["job"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright job} {greenBright >} holycow`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("project-variables-file custom-path (.envs)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        job: ["job2"],
        variablesFile: ".envs",
        noColor: true,
    }, writeStreams);

    const expected = `
job2 > SECRET_APP_DEBUG=true
job2 > SECRET_APP_ENV=local
job2 > SECRET_APP_KEY=
job2 > SECRET_APP_NAME=Laravel
job2 > SECRET_APP_URL=http://localhost
job2 > SECRET_BROADCAST_DRIVER=log
job2 > SECRET_CACHE_DRIVER=file
job2 > SECRET_DB_CONNECTION=mysql
job2 > SECRET_DB_DATABASE=laravel
job2 > SECRET_DB_HOST=127.0.0.1
job2 > SECRET_DB_PASSWORD=
job2 > SECRET_DB_PORT=3306
job2 > SECRET_DB_USERNAME=root
job2 > SECRET_FILESYSTEM_DISK=local
job2 > SECRET_KNOWN_HOSTS=~/known_hosts
job2 > SECRET_LOG_CHANNEL=stack
job2 > SECRET_LOG_DEPRECATIONS_CHANNEL=null
job2 > SECRET_LOG_LEVEL=debug
job2 > SECRET_MEMCACHED_HOST=127.0.0.1
job2 > SECRET_QUEUE_CONNECTION=sync
job2 > SECRET_SESSION_DRIVER=file
job2 > SECRET_SESSION_LIFETIME=120`;

    const stdout = writeStreams.stdoutLines.join("\n");
    expect(stdout).toContain(expected);
});
