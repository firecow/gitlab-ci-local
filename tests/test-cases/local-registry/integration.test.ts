import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {Utils} from "../../../src/utils.js";

test("local-registry ci variables", async () => {
    const writeStreams = new WriteStreamsMock;
    await handler({
        cwd: "tests/test-cases/local-registry",
        job: ["registry-variables"],
        registry: true,
        noColor: true,
    }, writeStreams);

    const expected = [
        `registry-variables > CI_REGISTRY=${Utils.gclRegistryPrefix}`,
        `registry-variables > CI_REGISTRY_USER=${Utils.gclRegistryPrefix}.user`,
        `registry-variables > CI_REGISTRY_PASSWORD=${Utils.gclRegistryPrefix}.password`,
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
