import {Utils} from "../utils";

test('VAR exists success', () => {
    const ruleIf = "$VAR";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'val'});
    expect(val).toBe(true);
});

test('VAR exists fail', () => {
    const ruleIf = "$VAR";
    const val = Utils.evaluateRuleIf(ruleIf, {});
    expect(val).toBe(false);
});

test('VAR exists empty', () => {
    const ruleIf = "$VAR";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: ''});
    expect(val).toBe(false);
});

test('VAR not null success', () => {
    const ruleIf = "$VAR != null";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: ''});
    expect(val).toBe(true);
});

test('VAR not null fail', () => {
    const ruleIf = "$VAR != null";
    const val = Utils.evaluateRuleIf(ruleIf, {});
    expect(val).toBe(false);
});

test('VAR equals true success', () => {
    const ruleIf = "$VAR == 'true'";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'true'});
    expect(val).toBe(true);
});

test('VAR equals true fail', () => {
    const ruleIf = "$VAR == 'true'";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'false'});
    expect(val).toBe(false);
});

test('VAR regex match success', () => {
    const ruleIf = "$VAR =~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'testvalue'});
    expect(val).toBe(true);
});

test('VAR regex match fail', () => {
    const ruleIf = "$VAR =~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'spiffy'});
    expect(val).toBe(false);
});

test('VAR regex not match success', () => {
    const ruleIf = "$VAR !~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'notamatch'});
    expect(val).toBe(true);
});

test('VAR regex not match fail', () => {
    const ruleIf = "$VAR !~ /testvalue/";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR: 'testvalue'});
    expect(val).toBe(false);
});

test('Conjunction success', () => {
    const ruleIf = "$VAR1 && $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: 'val', VAR2: 'val'});
    expect(val).toBe(true);
});

test('Conjunction fail', () => {
    const ruleIf = "$VAR1 && $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: 'val', VAR2: ''});
    expect(val).toBe(false);
});

test('Disjunction success', () => {
    const ruleIf = "$VAR1 || $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: 'val', VAR2: ''});
    expect(val).toBe(true);
});

test('Disjunction fail', () => {
    const ruleIf = "$VAR1 || $VAR2";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: '', VAR2: ''});
    expect(val).toBe(false);
});

test('Complex (con/dis)junction with parentheses success', () => {
    const ruleIf = "$VAR1 && ($VAR2 || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: 'val', VAR2: 'val', VAR3: ''});
    expect(val).toBe(true);
});

test('Complex (con/dis)junction with parentheses fail', () => {
    const ruleIf = "$VAR1 && ($VAR2 || $VAR3)";
    const val = Utils.evaluateRuleIf(ruleIf, {VAR1: 'val', VAR2: '', VAR3: ''});
    expect(val).toBe(true);
});
