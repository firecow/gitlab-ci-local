import {Utils} from "../utils";

test('Variable without brackets success', () => {
    const expanded = Utils.expandEnv('$VAR', { VAR: 'success' });
    expect(expanded).toBe('success');
});

test('Variable with brackets success', () => {
    const expanded = Utils.expandEnv('${VAR}', { VAR: 'success' });
    expect(expanded).toBe('success');
});

test('Variable with brackets negative', () => {
    const expanded = Utils.expandEnv('$VAR', { UNSET_VAR: 'success' });
    expect(expanded).toBe('$VAR');
});

test('Variable without brackets negative', () => {
    const expanded = Utils.expandEnv('${VAR}', { VAR: 'success' });
    expect(expanded).toBe('success');
});
