import { Utils } from "../src/utils";

test("GITLAB_CI on_success", () => {
    const rules = [
        { if: "$GITLAB_CI == 'false'" },
    ];
    const rulesResult = Utils.getRulesResult(rules, { GITLAB_CI: "false" });
    expect(rulesResult).toEqual({ when: "on_success", allowFailure: false });
});

test("Regex on undef var", () => {
    const rules = [
        { if: "$CI_COMMIT_TAG =~ /^v\\d+.\\d+.\\d+/" },
        { when: "manual" },
    ];
    const rulesResult = Utils.getRulesResult(rules, {});
    expect(rulesResult).toEqual({ when: "manual", allowFailure: false });
});

test("GITLAB_CI fail and fallback", () => {
    const rules = [
        { if: "$GITLAB_CI == 'true'" },
        { when: "manual" },
    ];
    const rulesResult = Utils.getRulesResult(rules, { GITLAB_CI: "false" });
    expect(rulesResult).toEqual({ when: "manual", allowFailure: false });
});

test("Undefined if", () => {
    const rules = [
        { when: "on_success" },
    ];
    const rulesResult = Utils.getRulesResult(rules, {});
    expect(rulesResult).toEqual({ when: "on_success", allowFailure: false });
});

test("Undefined when", () => {
    const rules = [
        { if: "$GITLAB_CI", allow_failure: false },
    ];
    const rulesResult = Utils.getRulesResult(rules, { GITLAB_CI: "false" });
    expect(rulesResult).toEqual({ when: "on_success", allowFailure: false });
});

test("Early return", () => {
    const rules = [
        { if: "$GITLAB_CI", when: "never" },
        { when: "on_success" },
    ];
    const rulesResult = Utils.getRulesResult(rules, { GITLAB_CI: "false" });
    expect(rulesResult).toEqual({ when: "never", allowFailure: false });
});

describe("evaluate rules conditions", () => {
    test.each([
        {
            rule: "$VAR",
            variables: { VAR: "set-value" },
            expected: true,
        },
        {
            rule: "$VAR",
            variables: {},
            expected: false,
        },
        {
            rule: "$VAR",
            variables: { VAR: "" },
            expected: false,
        },
        {
            rule: "$VAR != null",
            variables: { VAR: "" },
            expected: true,
        },
        {
            rule: "$VAR != null",
            variables: {},
            expected: false,
        },
        {
            rule: "$VAR == 'true'",
            variables: { VAR: "true" },
            expected: true,
        },
        {
            rule: "$VAR == 'false'",
            variables: { VAR: "false" },
            expected: true,
        },
        {
            rule: "$VAR != 'true'",
            variables: { VAR: "true" },
            expected: false,
        },
        {
            rule: "$VAR != 'false'",
            variables: { VAR: "false" },
            expected: false,
        },
        {
            rule: "$VAR =~ /testvalue/",
            variables: { VAR: "testvalue" },
            expected: true,
        },
        {
            rule: "$VAR =~ /testvalue/i",
            variables: { VAR: "testvalue" },
            expected: true,
        },
        {
            rule: "$VAR =~ /testvalue/",
            variables: { VAR: "spiffy" },
            expected: false,
        },
        {
            rule: "$VAR =~ /testvalue/i",
            variables: { VAR: "spiffy" },
            expected: false,
        },
        {
            rule: "$VAR !~ /testvalue/",
            variables: { VAR: "notamatch" },
            expected: true,
        },
        {
            rule: "$VAR !~ /testvalue/i",
            variables: { VAR: "notamatch" },
            expected: true,
        },
        {
            rule: "$VAR !~ /testvalue/",
            variables: { VAR: "testvalue" },
            expected: false,
        },
        {
            rule: "$VAR !~ /testvalue/i",
            variables: { VAR: "testvalue" },
            expected: false,
        },
        {
            rule: "$VAR =~ /123/",
            variables: {},
            expected: false,
        },
        {
            rule: "true && $VAR =~ /123/",
            variables: {},
            expected: false,
        },
        {
            rule: "$VAR1 && $VAR2",
            variables: { VAR1: "val", VAR2: "val" },
            expected: true,
        },
        {
            rule: "$VAR1 && $VAR2",
            variables: { VAR1: "val", VAR2: "" },
            expected: false,
        },
        {
            rule: "$VAR1 || $VAR2",
            variables: { VAR1: "val", VAR2: "" },
            expected: true,
        },
        {
            rule: "$VAR1 || $VAR2",
            variables: { VAR1: "", VAR2: "" },
            expected: false,
        },
        {
            rule: "$VAR1 && ($VAR2 || $VAR3)",
            variables: { VAR1: "val", VAR2: "val", VAR3: "" },
            expected: true,
        },
        {
            rule: "$VAR1 && ($VAR2 || $VAR3)",
            variables: { VAR1: "val", VAR2: "", VAR3: "" },
            expected: false,
        },
        {
            rule: "$VAR1 =~ /val/ && ($VAR2 =~ /val/ || $VAR3)",
            variables: { VAR1: "val", VAR2: "val", VAR3: "" },
            expected: true,
        },
        {
            rule: "$VAR1 =~ /val/i && ($VAR2 =~ /val/ || $VAR3)",
            variables: { VAR1: "VAL", VAR2: "val", VAR3: "" },
            expected: true,
        },
        {
            rule: "$VAR1 =~ /val/ && ($VAR2 =~ /val/ || $VAR3)",
            variables: { VAR1: "val", VAR2: "not", VAR3: "" },
            expected: false,
        },
        {
            rule: "$VAR1 =~ /val/i && ($VAR2 =~ /val/ || $VAR3)",
            variables: { VAR1: "VAL", VAR2: "not", VAR3: "" },
            expected: false,
        },
    ])("`$rule` \t with $variables \t to $expected", ({ rule, variables, expected }) => {
        expect(Utils.evaluateRuleIf(rule, variables as { [key: string]: string })).toBe(expected);
    });
});
