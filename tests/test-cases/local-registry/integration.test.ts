import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {gclRegistryPrefix} from "../../../src/docker-registry.js";

test("local-registry ci variables", async () => {
    const writeStreams = new WriteStreamsMock;
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-variables"],
        registry: true,
        noColor: true,
    }, writeStreams);

    const expected = [
        `registry-variables > CI_REGISTRY=${gclRegistryPrefix}`,
        `registry-variables > CI_REGISTRY_USER=${gclRegistryPrefix}.user`,
        `registry-variables > CI_REGISTRY_PASSWORD=${gclRegistryPrefix}.password`,
    ];

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("local-registry login <docker>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-login-docker"],
        registry: true,
        noColor: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(["registry-login-docker > Login Succeeded"]));
});

test("local-registry login <oci>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-login-oci"],
        registry: true,
        privileged: true,
        noColor: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(["registry-login-oci > Login Succeeded!"]));
});

test("local-registry login <dind>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-login-dind"],
        registry: true,
        privileged: true,
        noColor: true,
    }, writeStreams);

    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(["registry-login-dind > Login Succeeded"]));
});
