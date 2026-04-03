import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
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

test.concurrent("project-variables-file <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        job: ["test-job"],
        noColor: true,
        stateDir: ".gitlab-ci-local-test-job",
    }, writeStreams);

    const expected = [
        "test-job > Y",
        "test-job > Recursive CI/CD",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file <issue-1508>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        job: ["issue-1508"],
        variable: ["XDEBUG_MODE=debug,develop"],
        noColor: true,
        stateDir: ".gitlab-ci-local-issue-1508",
    }, writeStreams);

    const expected = [
        "issue-1508 > minikube",
        "issue-1508 > /root/.kube/config",
        "issue-1508 > debug,develop",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file <issue-1333>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-issue-1333.yml",
        noColor: true,
        stateDir: ".gitlab-ci-local-issue-1333",
    }, writeStreams);

    const expected = [
        "issue-1333 > firecow",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file custom-path", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        variablesFile: ".custom-local-var-file",
        job: ["job"],
        noColor: true,
        stateDir: ".gitlab-ci-local-custom-path",
    }, writeStreams);

    const expected = [
        "job > firecow",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file empty-variable-file", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        variablesFile: emptyFileVariable,
        job: ["job"],
        preview: true,
        stateDir: ".gitlab-ci-local-empty-variable-file",
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

test.concurrent("project-variables-file custom-path (.env)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        variablesFile: ".env",
        job: ["job"],
        noColor: true,
        stateDir: ".gitlab-ci-local-custom-path-env",
    }, writeStreams);

    const expected = [
        "job > holycow",
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("project-variables-file custom-path (.envs)", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: cwd,
        file: ".gitlab-ci-custom.yml",
        job: ["job2"],
        variablesFile: ".envs",
        noColor: true,
        stateDir: ".gitlab-ci-local-custom-path-envs",
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
