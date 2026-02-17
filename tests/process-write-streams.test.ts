import {spyOn, afterEach, afterAll, test, expect} from "bun:test";
import {WriteStreamsProcess} from "../src/write-streams.js";

const spyStdout = spyOn(process.stdout, "write").mockImplementation(() => true);
const spyStderr = spyOn(process.stderr, "write").mockImplementation(() => true);

afterEach(() => {
    spyStdout.mockClear();
    spyStderr.mockClear();
});

afterAll(() => {
    spyStdout.mockRestore();
    spyStderr.mockRestore();
});

test("Check ProcessWriteStreams ", () => {
    const writeStreams = new WriteStreamsProcess();
    writeStreams.stdout("Stdout message");
    writeStreams.stderr("Stderr message");
    expect(spyStdout).toHaveBeenLastCalledWith("Stdout message");
    expect(spyStderr).toHaveBeenLastCalledWith("Stderr message");
});
