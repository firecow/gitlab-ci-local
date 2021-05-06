import {MockWriteStreams} from "../../../src/mock-write-streams";
import {handler} from "../../../src/handler";
import * as chalk from "chalk";

test("interactive-image <image-job>", async () => {
    try {
        const writeStreams = new MockWriteStreams();
        await handler({
            cwd: "tests/test-cases/interactive-image",
            job: ["image-job"],
        }, writeStreams);
    } catch (e) {
        expect(e.message).toEqual(chalk`{blueBright image-job} @Interactive decorator cannot have image: and must be when:manual`);
    }
});
