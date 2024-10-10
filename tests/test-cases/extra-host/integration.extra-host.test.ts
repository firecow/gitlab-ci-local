import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import fs from "fs-extra";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test("extra-host <test-job>", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/extra-host",
        job: ["test-job"],
        extraHost: ["fake-google.com:142.250.185.206"],
    }, writeStreams);

    const expected = [
        chalk`{blueBright test-job} {greenBright >} HTTP/1.1 404 Not Found`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));
});

test("extra-host <service-job>", async () => {
    await fs.promises.rm("tests/test-cases/extra-host/.gitlab-ci-local/services-output/service-job/docker.io/alpine:latest-0.log", {force: true});

    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/extra-host",
        job: ["service-job"],
        extraHost: ["fake-google.com:142.250.185.206"],
    }, writeStreams);

    expect(writeStreams.stdoutLines.join("\n")).toMatch(/true/);
    expect(await fs.pathExists("tests/test-cases/extra-host/.gitlab-ci-local/services-output/service-job/docker.io/alpine:latest-0.log")).toEqual(true);
    expect(await fs.readFile("tests/test-cases/extra-host/.gitlab-ci-local/services-output/service-job/docker.io/alpine:latest-0.log", "utf-8")).toMatch(/142.250.185.206/);
});
