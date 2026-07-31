import "../src/global.js";
import chalkBase, {type ColorSupportLevel} from "chalk";
import {Argv} from "../src/argv.js";
import {WriteStreamsMock} from "../src/write-streams.js";

let writeStreams: WriteStreamsMock;
let originalLevel: ColorSupportLevel;
let originalNoColor: string | undefined;

beforeEach(() => {
    writeStreams = new WriteStreamsMock();
    originalLevel = chalkBase.level;
    originalNoColor = process.env.NO_COLOR;
});

afterEach(() => {
    chalkBase.level = originalLevel;
    if (originalNoColor === undefined) {
        delete process.env.NO_COLOR;
    } else {
        process.env.NO_COLOR = originalNoColor;
    }
});

test("color stays enabled by default", async () => {
    chalkBase.level = 2;
    delete process.env.NO_COLOR;
    await Argv.build({}, writeStreams);
    expect(chalkBase.level).toBe(2);
});

test("--no-color disables color", async () => {
    chalkBase.level = 2;
    delete process.env.NO_COLOR;
    await Argv.build({color: false}, writeStreams);
    expect(chalkBase.level).toBe(0);
});

test("NO_COLOR disables color", async () => {
    chalkBase.level = 2;
    process.env.NO_COLOR = "1";
    await Argv.build({}, writeStreams);
    expect(chalkBase.level).toBe(0);
});

test("an empty NO_COLOR leaves color enabled", async () => {
    chalkBase.level = 2;
    process.env.NO_COLOR = "";
    await Argv.build({}, writeStreams);
    expect(chalkBase.level).toBe(2);
});
