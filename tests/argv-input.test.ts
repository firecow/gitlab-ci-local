import "../src/global.js";
import {Argv} from "../src/argv.js";
import {WriteStreamsMock} from "../src/write-streams.js";

let writeStreams: WriteStreamsMock;

beforeEach(() => {
    writeStreams = new WriteStreamsMock();
});

test("input parses component names with slashes", async () => {
    const argv = await Argv.build({input: ["templates/deploy:replicas=5"]}, writeStreams);
    const result = argv.input;
    expect(result["templates/deploy"]).toEqual({replicas: 5});
});

test("input keeps global and component keys separate", async () => {
    const argv = await Argv.build({input: ["deploy:replicas=5", "environment=prod"]}, writeStreams);
    const result = argv.input;
    expect(result["deploy"]).toEqual({replicas: 5});
    expect(result["environment"]).toEqual("prod");
});

test("input ignores __proto__ component to prevent prototype pollution", async () => {
    const argv = await Argv.build({input: ["__proto__:polluted=true"]}, writeStreams);
    const result = argv.input;
    expect(Object.hasOwn(result, "__proto__")).toBe(false);
    expect(({} as any).polluted).toBeUndefined();
});

test("input ignores __proto__ key to prevent prototype pollution", async () => {
    const argv = await Argv.build({input: ["__proto__=true"]}, writeStreams);
    const result = argv.input;
    expect(Object.keys(result)).not.toContain("__proto__");
});

test("input ignores constructor key to prevent prototype pollution", async () => {
    const argv = await Argv.build({input: ["constructor:toString=bad"]}, writeStreams);
    const result = argv.input;
    expect(Object.hasOwn(result, "constructor")).toBe(false);
});
