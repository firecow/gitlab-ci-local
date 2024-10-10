import {Utils} from "../src/utils.js";
import {WriteStreamsMock} from "../src/write-streams.js";

test("Print job on first index", () => {
    const writeStreams = new WriteStreamsMock();
    Utils.printJobNames((txt) => writeStreams.stdout(txt), {name: "Hello"}, 0, [{name: "Hello"}, {name: "Hello"}, {name: "Hello"}]);
    writeStreams.flush();
    expect(writeStreams.stdoutLines).toEqual(["[94mHello[39m, "]);
});

test("Print job on last index", () => {
    const writeStreams = new WriteStreamsMock();
    Utils.printJobNames((txt) => writeStreams.stdout(txt), {name: "Hello"}, 2, [{name: "Hello"}, {name: "Hello"}, {name: "Hello"}]);
    writeStreams.flush();
    expect(writeStreams.stdoutLines).toEqual(["[94mHello[39m"]);
});
