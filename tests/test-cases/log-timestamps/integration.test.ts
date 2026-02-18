import {WriteStreamsMock} from "../../../src/write-streams.js";
import {handler} from "../../../src/handler.js";
import {initSpawnSpy} from "../../mocks/utils.mock.js";
import {WhenStatics} from "../../mocks/when-statics.js";
import assert from "assert";

beforeAll(() => {
    initSpawnSpy(WhenStatics.all);
});

const pipelineDirectory = "tests/test-cases/log-timestamps";

test.concurrent("logs - show timestamps", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        timestamps: true,
        stateDir: ".gitlab-ci-local-logs-show-timestamps",
    }, writeStreams);


    assert(writeStreams.stdoutLines.some(line => /\[\d\d:\d\d:\d\d\s+[0-9.ms ]+].*sleep 1/.test(line)));
    assert(writeStreams.stdoutLines.some(line => /\[\d\d:\d\d:\d\d\s+[0-9.s ]+].*test done/.test(line)));
    assert(writeStreams.stdoutLines.some(line => /PASS.*\[[0-9.s ]+].*build-job/.test(line)));
    assert(writeStreams.stdoutLines.some(line => /FAIL.*\[[0-9.ms ]+].*failed-job/.test(line)));
});

test.concurrent("logs - without timestamps", async () => {
    const writeStreams = new WriteStreamsMock();
    await handler({
        cwd: pipelineDirectory,
        stateDir: ".gitlab-ci-local-logs-without-timestamps",
    }, writeStreams);


    // ensure we don't find timestamps by default
    assert(writeStreams.stdoutLines.every(line => !/\[\d\d:\d\d:\d\d\s+[0-9.ms ]+].*sleep 1/.test(line)));
    assert(writeStreams.stdoutLines.every(line => !/\[\d\d:\d\d:\d\d\s+[0-9.s ]+].*test done/.test(line)));
    assert(writeStreams.stdoutLines.every(line => !/PASS.*\[[0-9.s ]+].*build-job/.test(line)));
});