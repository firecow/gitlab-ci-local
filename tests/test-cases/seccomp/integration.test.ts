import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("seccomp <test-seccomp-present>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/seccomp",
        job: ["test-seccomp-present"],
        stateDir: ".gitlab-ci-local-confined",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-seccomp-present} {greenBright >} seccomp present`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("seccomp <test-seccomp-not-present>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/seccomp",
        job: ["test-seccomp-not-present"],
        seccomp: "unconfined",
        stateDir: ".gitlab-ci-local-unconfined",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-seccomp-not-present} {greenBright >} seccomp not present`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test.concurrent("seccomp <test-service-seccomp>", async () => {
    const stateDir = ".gitlab-ci-local-service-seccomp";
    await fs.promises.rm(`tests/test-cases/seccomp/${stateDir}`, {recursive: true, force: true});
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/seccomp",
        job: ["test-service-seccomp"],
        caFile: "ca-cert.crt",
        seccomp: "unconfined",
        stateDir,
    }, writeStreams);

    const serviceLog = await fs.readFile(`tests/test-cases/seccomp/${stateDir}/services-output/test-service-seccomp/docker.io/alpine:3.21-0.log`, "utf8");
    expect(serviceLog).toContain("Seccomp:\t0");
});
