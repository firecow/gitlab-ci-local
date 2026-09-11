import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

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


test.concurrent("custom-ca-cert-and-seccomp <test-ca-cert-and-seccomp>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/seccomp",
        job: ["test-ca-cert-and-seccomp"],
        caFile: "ca-cert.crt",
        seccomp: "unconfined",
        stateDir: ".gitlab-ci-local-custom-ca-cert-seccomp",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-ca-cert-and-seccomp} {greenBright >} seccomp not present`,
        chalk`{blueBright test-ca-cert-and-seccomp} {greenBright >} CA cert file exists`,
        chalk`{blueBright test-ca-cert-and-seccomp} {greenBright >} SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt`,
        chalk`{blueBright test-ca-cert-and-seccomp} {greenBright >} SSL_CERT_DIR=/etc/ssl/certs`,
        chalk`{blueBright test-ca-cert-and-seccomp} {greenBright >} -----BEGIN CERTIFICATE-----`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
