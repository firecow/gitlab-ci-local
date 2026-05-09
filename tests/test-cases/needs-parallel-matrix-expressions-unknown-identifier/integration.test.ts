import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("needs-parallel-matrix-expressions-unknown-identifier rejects $[[ matrix.X ]] referencing unknown matrix key", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({
        cwd: "tests/test-cases/needs-parallel-matrix-expressions-unknown-identifier",
    }, writeStreams)).rejects.toThrow(
        chalk`'{yellow NOPE}' does not exist in matrix configuration`,
    );
});
