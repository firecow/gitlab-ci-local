import {resolveSemanticVersionRange} from "../src/parser-includes.js";

const tests = [
    {
        name: "`~latest` should return the latest release version",
        range: "~latest",
        expect: "2.1.0",
    },
    {
        name: "`1` should return the latest minor version",
        range: "1",
        expect: "1.2.1",
    },
    {
        name: "`1.1` should return the latest patch version",
        range: "1.1",
        expect: "1.1.1",
    },
    {
        name: "should return undefined if none of the version satisfies the range",
        range: "9999999",
        expect: undefined,
    },
];

const gitTags = [
    "1.0.0",
    "1.1.0",
    "non-semver-compliant-tag",
    "2.0.0",
    "1.1.1",
    "1.2.0",
    "1.2.1",
    "2.1.0",
    "2.0.1",
    "2.2.0-rc",
    "2.3.0-pre",
];

describe("resolveSemanticVersionRange", () => {
    tests.forEach((t) => {
        test(t.name, async () => {
            const result = resolveSemanticVersionRange(t.range, gitTags);
            expect(result).toEqual(t.expect);
        });
    });
});
