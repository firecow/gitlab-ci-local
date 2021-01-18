import {Utils} from "../utils";


test('GITLAB_USER_LOGIN positive', () => {
    const variables = { APP_ENV: '$GITLAB_USER_LOGIN', HOSTNAME: '${GITLAB_USER_LOGIN}-stage.domain.com' }
    const expanded = Utils.expandVariables(variables, { GITLAB_USER_LOGIN: 'mjn'});
    expect(expanded).toEqual({ APP_ENV: 'mjn', HOSTNAME: 'mjn-stage.domain.com' });
});

test('GITLAB_USER_LOGIN negative', () => {
    const variables = { APP_ENV: '$GITLAB_USER_LOGIN', HOSTNAME: '${GITLAB_USER_LOGIN}-stage.domain.com' }
    const expanded = Utils.expandVariables(variables, { NOT_GITLAB_USER_LOGIN: 'mjn'});
    expect(expanded).toEqual({ APP_ENV: '$GITLAB_USER_LOGIN', HOSTNAME: '${GITLAB_USER_LOGIN}-stage.domain.com' });
});

test('VAR w.o. brackets positive', () => {
    const expanded = Utils.expandText('$VAR', { VAR: 'success' });
    expect(expanded).toBe('success');
});

test('VAR w.o. brackets negative', () => {
    const expanded = Utils.expandText('$VAR', { UNSET_VAR: 'success' });
    expect(expanded).toBe('$VAR');
});

test('VAR w. brackets postive', () => {
    const expanded = Utils.expandText('${VAR}', { VAR: 'success' });
    expect(expanded).toBe('success');
});

test('VAR w. brackets negative', () => {
    const expanded = Utils.expandText('${VAR}', { UNSET_VAR: 'success' });
    expect(expanded).toBe('success');
});
