import {Utils} from "../utils";


test('Variable without brackets success', () => {
    const variables = { APP_ENV: '$GITLAB_USER_LOGIN', TUNNEL_HOSTNAME: '${GITLAB_USER_LOGIN}-dk.latoyapip.org' }
    const expanded = Utils.expandVariables(variables, { GITLAB_USER_LOGIN: 'mjn'});
    expect(expanded).toEqual({ APP_ENV: 'mjn', TUNNEL_HOSTNAME: 'mjn-dk.latoyapip.org' });
});

test('Variable without brackets success', () => {
    const expanded = Utils.expandText('$VAR', { VAR: 'success' });
    expect(expanded).toBe('success');
});

test('Variable with brackets success', () => {
    const expanded = Utils.expandText('${VAR}', { VAR: 'success' });
    expect(expanded).toBe('success');
});

test('Variable with brackets negative', () => {
    const expanded = Utils.expandText('$VAR', { UNSET_VAR: 'success' });
    expect(expanded).toBe('$VAR');
});

test('Variable without brackets negative', () => {
    const expanded = Utils.expandText('${VAR}', { VAR: 'success' });
    expect(expanded).toBe('success');
});
