import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Utils} from "../../../src/utils.js";
import chalk from "chalk";

test("local-registry ci variables", async () => {
    const writeStreams = new WriteStreamsMock;
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-variables"],
        registry: true
    }, writeStreams);

    const expected = [
        chalk`{blueBright registry-variables} {greenBright >} CI_REGISTRY=${Utils.gclRegistryPrefix}`,
        chalk`{blueBright registry-variables} {greenBright >} CI_REGISTRY_USER=${Utils.gclRegistryPrefix}.user`,
        chalk`{blueBright registry-variables} {greenBright >} CI_REGISTRY_PASSWORD=${Utils.gclRegistryPrefix}.password`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("local-registry login <docker>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-login-docker"],
        registry: true
    }, writeStreams);


    const expected = [
        chalk`{blueBright registry-login-docker} {greenBright >} Login Succeeded`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("local-registry login <oci>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-login-oci"],
        registry: true
    }, writeStreams);


    const expected = [
        chalk`{blueBright registry-login-oci} {greenBright >} Login Succeeded!`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});
