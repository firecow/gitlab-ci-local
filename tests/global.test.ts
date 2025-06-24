import "../src/global";
import {RE2JS} from "re2js";

const tests = [
    {
        paragraph: "hello world",
        regexp: "world",
        description: "basic string pattern",
    },
    {
        paragraph: "hello world",
        regexp: "foo",
        description: "no match found",
    },
    {
        paragraph: "foo bar foo baz foo",
        regexp: "foo",
        description: "multiple matches",
    },
    {
        paragraph: "abc123def456",
        regexp: "(\\d+)",
        description: "match with capturing group",
    },
    {
        paragraph: "color: #ff0000; background: #00ff00;",
        regexp: "#(?<hex>[0-9a-fA-F]{6})",
        description: "named capturing group",
    },
    {
        paragraph: "aaaa",
        regexp: "aa",
        description: "overlapping matches",
    },
    {
        paragraph: "",
        regexp: "a",
        description: "empty string",
    },
    {
        paragraph: "abc123abc",
        regexp: "^abc|abc$",
        description: "match at start or end",
    },
    {
        paragraph: "a.b*c+d?",
        regexp: "\\.",
        description: "special character dot",
    },
];

describe("matchAllRE2JS should behave similarly to matchAll", () => {
    tests.forEach((t) => {
        test(t.description, () => {
            const matchAll = Array.from(t.paragraph.matchAll(new RegExp(t.regexp, "g")));
            const matchAllRE2JS = Array.from(t.paragraph.matchAllRE2JS(RE2JS.compile(t.regexp)));
            expect(matchAllRE2JS).toStrictEqual(matchAll);
        });
    });
});
