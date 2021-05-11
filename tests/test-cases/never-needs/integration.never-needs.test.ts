import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import chalk from "chalk";

test("never-needs <test-job> --needs", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/never-needs/",
            job: ["test-job"],
            needs: true,
        }, writeStreams);
    } catch (e) {
        expect(e.message).toBe(chalk`{blueBright never-job} is when:never, but its needed by {blueBright test-job}`);
    }
});
