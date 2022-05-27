import {Utils} from "../src/utils";

test("GITLAB_CI on_success", () => {
    const rules = [
        {if: "$GITLAB_CI == 'false'"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {GITLAB_CI: "false"});
    expect(rulesResult).toEqual({when: "on_success", allowFailure: false});
});

test("Regex on undef var", () => {
    const rules = [
        {if: "$CI_COMMIT_TAG =~ /^v\\d+.\\d+.\\d+/"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {});
    expect(rulesResult).toEqual({when: "never", allowFailure: false});
});

test("Negated regex on undef var", () => {
    const rules = [
        {if: "$CI_COMMIT_TAG !~ /^v\\d+.\\d+.\\d+/"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {});
    expect(rulesResult).toEqual({when: "never", allowFailure: false});
});

test("GITLAB_CI fail and fallback", () => {
    const rules = [
        {if: "$GITLAB_CI == 'true'"},
        {when: "manual"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {GITLAB_CI: "false"});
    expect(rulesResult).toEqual({when: "manual", allowFailure: false});
});

test("Undefined if", () => {
    const rules = [
        {when: "on_success"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {});
    expect(rulesResult).toEqual({when: "on_success", allowFailure: false});
});

test("Undefined when", () => {
    const rules = [
        {if: "$GITLAB_CI", allow_failure: false},
    ];
    const rulesResult = Utils.getRulesResult(rules, {GITLAB_CI: "false"});
    expect(rulesResult).toEqual({when: "on_success", allowFailure: false});
});

test("Early return", () => {
    const rules = [
        {if: "$GITLAB_CI", when: "never"},
        {when: "on_success"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {GITLAB_CI: "false"});
    expect(rulesResult).toEqual({when: "never", allowFailure: false});
});

test("VAR exists positive", () => {
    const ruleIf = "$VAR";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "set-value"});
    expect(val).toBe(true);
});

test("VAR exists fail", () => {
    const ruleIf = "$VAR";
    const val = Utils.evaluateRuleIf(ruleIf, {});
    expect(val).toBe(false);
});

test("VAR exists empty", () => {
    const ruleIf = "$VAR";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: ""});
    expect(val).toBe(false);
});

test("VAR not null success", () => {
    const ruleIf = "$VAR != null";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: ""});
    expect(val).toBe(true);
});

test("VAR not null fail", () => {
    const ruleIf = "$VAR != null";
    const val = Utils.evaluateRuleIf(ruleIf, {});
    expect(val).toBe(false);
});

test("VAR equals true success", () => {
    const ruleIf = "$VAR == 'true'";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "true"});
    expect(val).toBe(true);
});

test("VAR equals true fail", () => {
    const ruleIf = "$VAR == 'true'";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "false"});
    expect(val).toBe(false);
});

test("VAR regex match success", () => {
    const ruleIf = "$VAR =~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "testvalue"});
    expect(val).toBe(true);
});

test("VAR regex match success - case insensitive", () => {
    const ruleIf = "$VAR =~ /testvalue/i";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "testvalue"});
    expect(val).toBe(true);
});

test("VAR regex match fail", () => {
    const ruleIf = "$VAR =~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "spiffy"});
    expect(val).toBe(false);
});

test("VAR regex match fail - case insensitive", () => {
    const ruleIf = "$VAR =~ /testvalue/i";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "spiffy"});
    expect(val).toBe(false);
});

test("VAR regex not match success", () => {
    const ruleIf = "$VAR !~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "notamatch"});
    expect(val).toBe(true);
});

test("VAR regex not match success - case insensitive", () => {
    const ruleIf = "$VAR !~ /testvalue/i";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "notamatch"});
    expect(val).toBe(true);
});

test("VAR regex not match fail", () => {
    const ruleIf = "$VAR !~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "testvalue"});
    expect(val).toBe(false);
});

test("VAR regex not match fail - case insensitive", () => {
    const ruleIf = "$VAR !~ /testvalue/i";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: "testvalue"});
    expect(val).toBe(false);
});

test("VAR undefined", () => {
    const ruleIf = "$VAR =~ /123/";
    const val = Utils.evaluateRuleIf(ruleIf, {});
    expect(val).toBe(false);
});

test("VAR undefined (2nd condition)", () => {
    const ruleIf = "true && $VAR =~ /123/";
    const val = Utils.evaluateRuleIf(ruleIf, {});
    expect(val).toBe(false);
});

test("Conjunction success", () => {
    const ruleIf = "$VAR1 && $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: "val"});
    expect(val).toBe(true);
});

test("Conjunction fail", () => {
    const ruleIf = "$VAR1 && $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: ""});
    expect(val).toBe(false);
});

test("Disjunction success", () => {
    const ruleIf = "$VAR1 || $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: ""});
    expect(val).toBe(true);
});

test("Disjunction fail", () => {
    const ruleIf = "$VAR1 || $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "", VAR2: ""});
    expect(val).toBe(false);
});

test("Complex parentheses junctions var exists success", () => {
    const ruleIf = "$VAR1 && ($VAR2 || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: "val", VAR3: ""});
    expect(val).toBe(true);
});

test("Complex parentheses junctions var exists fail", () => {
    const ruleIf = "$VAR1 && ($VAR2 || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: "", VAR3: ""});
    expect(val).toBe(false);
});

test("Complex parentheses junctions regex success", () => {
    const ruleIf = "$VAR1 =~ /val/ && ($VAR2 =~ /val/ || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: "val", VAR3: ""});
    expect(val).toBe(true);
});

test("Complex parentheses junctions regex success - case insensitive", () => {
    const ruleIf = "$VAR1 =~ /val/i && ($VAR2 =~ /val/ || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "VAL", VAR2: "val", VAR3: ""});
    expect(val).toBe(true);
});

test("Complex parentheses junctions regex fail", () => {
    const ruleIf = "$VAR1 =~ /val/ && ($VAR2 =~ /val/ || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "val", VAR2: "not", VAR3: ""});
    expect(val).toBe(false);
});

test("Complex parentheses junctions regex fail - case insensitive", () => {
    const ruleIf = "$VAR1 =~ /val/i && ($VAR2 =~ /val/ || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: "VAL", VAR2: "not", VAR3: ""});
    expect(val).toBe(false);
});

test("https://github.com/firecow/gitlab-ci-local/issues/350", () => {
    let rules, rulesResult;

    rules = [
        {if: "$CI_COMMIT_BRANCH =~ /master$/", when: "manual"},
    ];
    rulesResult = Utils.getRulesResult(rules, {CI_COMMIT_BRANCH: "master"});
    expect(rulesResult).toEqual({when: "manual", allowFailure: false});

    rules = [
        {if: "$CI_COMMIT_BRANCH =~ /$BRANCHNAME/", when: "manual"},
    ];
    rulesResult = Utils.getRulesResult(rules, {CI_COMMIT_BRANCH: "master", BRANCHNAME: "master"});
    expect(rulesResult).toEqual({when: "never", allowFailure: false});
});

test("https://github.com/firecow/gitlab-ci-local/issues/300", () => {
    let rules, rulesResult;
    rules = [
        {if: "$VAR1 && (($VAR3 =~ /ci-skip-job-/ && $VAR2 =~ $VAR3) || ($VAR3 =~ /ci-skip-stage-/ && $VAR2 =~ $VAR3))", when: "manual"},
    ];
    rulesResult = Utils.getRulesResult(rules, {VAR1: "val", VAR2: "ci-skip-job-", VAR3: "ci-skip-job-"});
    expect(rulesResult).toEqual({when: "manual", allowFailure: false});

    rules = [
        {if: "$VAR1 && (($VAR3 =~ /ci-skip-job-/ && $VAR2 =~ $VAR3) || ($VAR3 =~ /ci-skip-stage-/ && $VAR2 =~ $VAR3))", when: "manual"},
    ];
    rulesResult = Utils.getRulesResult(rules, {VAR1: "val", VAR2: "ci-skip-stage-", VAR3: "ci-skip-stage-"});
    expect(rulesResult).toEqual({when: "manual", allowFailure: false});
});

test("https://github.com/firecow/gitlab-ci-local/issues/424", () => {
    const rules = [
        {if: "$CI_COMMIT_REF_NAME =~ /^(develop$|release\\/.*|master$)/", when: "manual"},
    ];
    const rulesResult = Utils.getRulesResult(rules, {CI_COMMIT_REF_NAME: "develop"});
    expect(rulesResult).toEqual({when: "manual", allowFailure: false});
});
