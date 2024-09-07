import {WriteStreamsProcess} from "../src/write-streams.js";

const spyStdout = import.meta.jest.spyOn(process.stdout, "write").mockImplementation();
const spyStderr = import.meta.jest.spyOn(process.stderr, "write").mockImplementation();

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
