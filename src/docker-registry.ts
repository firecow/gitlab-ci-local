import {execa, ExecaError} from "execa";
import {Argv} from "./argv.js";
import {Shell} from "./shell.js";

export const gclRegistryPrefix = "registry.gcl.local";
// renovate: datasource=docker depName=registry
const gclRegistryImage = "registry:3.1.2";
// renovate: datasource=docker depName=alpine/openssl
const gclOpensslImage = "alpine/openssl:3.5.9";
// renovate: datasource=docker depName=curlimages/curl
const gclCurlImage = "curlimages/curl:8.23.0";

export async function startDockerRegistry (argv: Argv): Promise<void> {
    const gclRegistryCertVol = `${gclRegistryPrefix}.certs`;
    const gclRegistryDataVol = `${gclRegistryPrefix}.data`;
    const gclRegistryNet = `${gclRegistryPrefix}.net`;

    // create cert volume
    try {
        await Shell.spawn(`${argv.containerExecutable} volume create ${gclRegistryCertVol}`.split(" "));
    } catch (err) {
        if (err instanceof Error && !err.message.endsWith("already exists"))
            throw err;
    }

    // create self-signed cert/key files for https support
    const certExists = await Shell.spawn([argv.containerExecutable, "run", "--rm", "-v", `${gclRegistryCertVol}:/mnt/vol`, "alpine", "ls", `/mnt/vol/${gclRegistryPrefix}.crt`]).then(() => true, () => false);
    if (!certExists) {
        const opensslArgs = [
            "req", "-newkey", "rsa:4096", "-nodes", "-sha256",
            "-keyout", `/certs/${gclRegistryPrefix}.key`,
            "-x509", "-days", "365",
            "-out", `/certs/${gclRegistryPrefix}.crt`,
            "-subj", `/CN=${gclRegistryPrefix}`,
            "-addext", `subjectAltName=DNS:${gclRegistryPrefix}`,
        ];
        const generateCertsInPlace = [
            argv.containerExecutable, "run", "--rm", "-v", `${gclRegistryCertVol}:/certs`, "--entrypoint", "sh", gclOpensslImage, "-c",
            [
                "openssl", ...opensslArgs,
                "&&", "mkdir", "-p", `/certs/${gclRegistryPrefix}`,
                "&&", "cp", `/certs/${gclRegistryPrefix}.crt`, `/certs/${gclRegistryPrefix}/ca.crt`,
            ].join(" "),
        ];
        await Shell.spawn(generateCertsInPlace);
    }

    // create data volume
    try {
        await Shell.spawn([argv.containerExecutable, "volume", "create", gclRegistryDataVol]);
    } catch (err) {
        if (err instanceof Error && !err.message.endsWith("already exists"))
            throw err;
    }

    // create network
    try {
        await Shell.spawn([argv.containerExecutable, "network", "create", gclRegistryNet]);
    } catch (err) {
        if (err instanceof Error && !err.message.includes("already exists"))
            throw err;
    }

    await Shell.spawn([argv.containerExecutable, "rm", "-f", gclRegistryPrefix]);
    await Shell.spawn([
        argv.containerExecutable, "run", "-d", "--name", gclRegistryPrefix,
        "--network", gclRegistryNet,
        "--volume", `${gclRegistryDataVol}:/var/lib/registry`,
        "--volume", `${gclRegistryCertVol}:/certs:ro`,
        "-e", "REGISTRY_HTTP_ADDR=0.0.0.0:443",
        "-e", `REGISTRY_HTTP_TLS_CERTIFICATE=/certs/${gclRegistryPrefix}.crt`,
        "-e", `REGISTRY_HTTP_TLS_KEY=/certs/${gclRegistryPrefix}.key`,
        gclRegistryImage,
    ]);

    try {
        await Shell.spawn([argv.containerExecutable, "pull", gclCurlImage]);
        await execa(argv.containerExecutable, [
            "run", "--rm",
            "--network", gclRegistryNet,
            "--entrypoint", "sh",
            gclCurlImage,
            "-c", `until [ "$(curl -s -o /dev/null -k -w "%{http_code}" https://${gclRegistryPrefix}:443)" = "200" ]; do sleep 1; done;`,
        ], {
            timeout: 10000,
        });
    } catch (err) {
        await stopDockerRegistry(argv.containerExecutable);
        if ((err as ExecaError).timedOut) {
            throw new Error("local docker registry port check timed out", {cause: err});
        }
        throw err;
    }
}

export async function stopDockerRegistry (containerExecutable: string): Promise<void> {
    await Shell.spawn([containerExecutable, "rm", "-f", gclRegistryPrefix]);
}
