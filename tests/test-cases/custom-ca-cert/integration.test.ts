import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("custom-ca-cert <test-ca-cert>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/custom-ca-cert",
        job: ["test-ca-cert"],
        caFile: "ca-cert.crt",
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-ca-cert} {greenBright >} CA cert file exists`,
        chalk`{blueBright test-ca-cert} {greenBright >} SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt`,
        chalk`{blueBright test-ca-cert} {greenBright >} SSL_CERT_DIR=/etc/ssl/certs`,
        chalk`{blueBright test-ca-cert} {greenBright >} -----BEGIN CERTIFICATE-----`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
