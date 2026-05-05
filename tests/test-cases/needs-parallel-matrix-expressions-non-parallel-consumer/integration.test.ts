import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("needs-parallel-matrix-expressions-non-parallel-consumer rejects $[[ matrix.X ]] in a non-parallel consumer", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions-non-parallel-consumer",
    }, writeStreams)).rejects.toThrow(
        chalk`{blueBright linux:test} uses $[[ matrix.X ]] expressions in needs.parallel.matrix but is not parallelized with parallel:matrix`,
    );
});
