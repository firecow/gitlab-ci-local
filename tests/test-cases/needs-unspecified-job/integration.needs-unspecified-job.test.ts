import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("needs-unspecified-job <build-job> --needs", async () => {
    const writeStreams = new MockWriteStreams();
    try {
        await handler({
            cwd: "tests/test-cases/needs-unspecified-job",
            job: ["test-job"],
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`[ {blueBright invalid} ] jobs are needed by {blueBright test-job}, but they cannot be found`);
    }
});
