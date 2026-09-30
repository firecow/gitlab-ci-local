import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

test.concurrent("trigger", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: "tests/test-cases/trigger",
        stateDir: ".gitlab-ci-local-trigger",
        variable: ["BASE_VALUE=hello"],
    }, writeStreams);

    const expected = [
        chalk`{black.bgGreenBright  PASS } {blueBright pipe-gen-job           }`,
        chalk`{black.bgGreenBright  PASS } {blueBright include-trigger        }`,
        chalk`{black.bgGreenBright  PASS } {blueBright remote-trigger         }`,
        chalk`{black.bgGreenBright  PASS } {blueBright variable-expand-trigger}`,
        chalk`{black.bgGreenBright  PASS } {blueBright [variable-expand-trigger] -> print-derived-value}`,
    ];
    expect(writeStreams.stdoutLines).toEqual(expect.arrayContaining(expected));

    expect(writeStreams.stdoutLines.join("\n")).toContain("DERIVED_VALUE=hello-world");
});
