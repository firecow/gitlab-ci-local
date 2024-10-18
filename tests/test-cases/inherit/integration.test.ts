import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});


describe("inherit:variables", () => {
    test("false should disable inheritance of all global variables", async () => {
        const writeStreams = new WriteStreamsMock();
        await handler({
            file: ".gitlab-ci-inherit-variables.yml",
            cwd: "tests/test-cases/inherit",
            noColor: true,
            job: ["job1"],
        }, writeStreams);

        const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("job1 >")).join("\n");
        expect(filteredStdout).toEqual("");
    });

    test("list of specific variables should only inheritance the respective global variables", async () => {
        const writeStreams = new WriteStreamsMock();
        await handler({
            file: ".gitlab-ci-inherit-variables.yml",
            cwd: "tests/test-cases/inherit",
            noColor: true,
            job: ["job2"],
        }, writeStreams);

        const expected = `job2 > GCL_TESTS_VAR1=This is variable 1
job2 > GCL_TESTS_VAR2=This is variable 2`;

        const filteredStdout = writeStreams.stdoutLines.filter(f => f.startsWith("job2 >")).join("\n");
        expect(filteredStdout).toEqual(expected);
    });
});
