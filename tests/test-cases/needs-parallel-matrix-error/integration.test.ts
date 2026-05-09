import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import chalk from "chalk-template";

test.concurrent("needs-parallel-matrix-error <test-job> rejects when producer has no parallel:matrix", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({
        cwd: "tests/test-cases/needs-parallel-matrix-error",
        job: ["test-job"],
        needs: true,
    }, writeStreams)).rejects.toThrow(
        chalk`{blueBright test-job} uses needs.parallel.matrix targeting {blueBright build-job}, but {blueBright build-job} has no parallel:matrix configuration`,
    );
});

test.concurrent("needs-parallel-matrix-error <test-plain-parallel> rejects when producer is plain parallel:<int>", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({
        cwd: "tests/test-cases/needs-parallel-matrix-error",
        job: ["test-plain-parallel"],
        needs: true,
    }, writeStreams)).rejects.toThrow(
        chalk`{blueBright test-plain-parallel} uses needs.parallel.matrix targeting {blueBright build-int}, but {blueBright build-int} has no parallel:matrix configuration`,
    );
});

test.concurrent("needs-parallel-matrix-error <test-zero-match> rejects when selector matches zero permutations", async () => {
    const writeStreams = new WriteStreamsMock();
    await expect(handler({
        cwd: "tests/test-cases/needs-parallel-matrix-error",
        job: ["test-zero-match"],
        needs: true,
    }, writeStreams)).rejects.toThrow(
        chalk`{blueBright test-zero-match} needs.parallel.matrix selector for {blueBright build-foo} matched zero permutations`,
    );
});
