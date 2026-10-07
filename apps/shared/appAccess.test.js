'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS } = require('./permissionRegistry');
const { grantedAppIds, loginDecision, sessionRoleFor, diffAppGrants, sessionCanEnterApp, isPlatformAdmin, pageGate, effectiveSession } = require('./appAccess');

const viewer = { id: 'v1', email: 'v@x.test', role: 'viewer' };
const admin = { id: 'a1', email: 'admin@x.test', role: 'admin' };
const rows = ids => ids.map(app_id => ({ user_id: 'v1', app_id }));

test('granted apps: registry order, de-duplicated, unknown ids ignored; admins and the super-admin get everything', () => {
  assert.deepEqual(grantedAppIds(viewer, rows(['crm', 'cars', 'cars', 'ghost'])), ['cars', 'crm']);
  assert.deepEqual(grantedAppIds(viewer, []), []);
  assert.deepEqual(grantedAppIds(admin, []), APPS);
  assert.deepEqual(grantedAppIds(viewer, [], { isSuperAdmin: true }), APPS);
  assert.equal(isPlatformAdmin(viewer), false);
  assert.equal(isPlatformAdmin(viewer, { isSuperAdmin: true }), true);
});

test('login: multiple apps → launcher; exactly one → straight to that dashboard', () => {
  const multi = loginDecision({ user: viewer, grants: rows(['inventory', 'cars']), appId: 'cars' });
  assert.deepEqual(multi, { allowed: true, reason: 'ok', apps: ['cars', 'inventory'], next: '/launch' });
  const single = loginDecision({ user: viewer, grants: rows(['cars']), appId: 'cars' });
  assert.deepEqual(single, { allowed: true, reason: 'ok', apps: ['cars'], next: '/dashboard' });
  assert.equal(loginDecision({ user: viewer, grants: rows(['cars']), appId: 'cars', dashboard: '/view' }).next, '/view');
});

test('login: zero apps → no_apps; app not granted → app_not_granted (direct URL to an unassigned app is refused at sign-in)', () => {
  const none = loginDecision({ user: viewer, grants: [], appId: 'cars' });
  assert.deepEqual(none, { allowed: false, reason: 'no_apps', apps: [], next: null });
  const other = loginDecision({ user: viewer, grants: rows(['inventory']), appId: 'cars' });
  assert.deepEqual(other, { allowed: false, reason: 'app_not_granted', apps: ['inventory'], next: null });
  assert.equal(loginDecision({ user: viewer, grants: rows(['cars']), appId: 'nope' }).allowed, false);
});

test('login: platform admins and the super-admin keep full access to every app', () => {
  assert.deepEqual(loginDecision({ user: admin, grants: [], appId: 'crm' }), { allowed: true, reason: 'ok', apps: APPS, next: '/launch' });
  assert.equal(loginDecision({ user: viewer, grants: [], appId: 'crm', isSuperAdmin: true }).allowed, true);
});

test('session role: platform admins and the super-admin are admin on every login tab; others keep the grant role', () => {
  assert.equal(sessionRoleFor({ user: viewer, grant: { app_role: 'manager' } }), 'manager');
  assert.equal(sessionRoleFor({ user: viewer, grant: null }), 'readonly');
  assert.equal(sessionRoleFor({ user: admin, grant: null }), 'admin');
  assert.equal(sessionRoleFor({ user: viewer, grant: { app_role: 'readonly' }, isSuperAdmin: true }), 'admin');
});

/* Regression: Cars "Users -> Dashboard" */
const GATE = { appId: 'cars', adminOnlyPrefixes: ['/users'] };

test('REGRESSION: ADMIN can open /users and is not redirected to /dashboard', () => {
  const adminSession = { sub: 'a1', email: 'admin@x.test', role: 'admin', apps: ['cars'] };
  assert.deepEqual(pageGate({ ...GATE, session: adminSession, pathname: '/users' }), { action: 'next' });
  assert.deepEqual(pageGate({ ...GATE, session: adminSession, pathname: '/users/roles/manager' }), { action: 'next' });
  assert.deepEqual(pageGate({ ...GATE, session: adminSession, pathname: '/dashboard' }), { action: 'next' });
});

test('REGRESSION: direct /users with a super-admin session minted by the OTP-only tab (JWT role readonly) opens Users', () => {
  const raw = { sub: 'a1', email: 'arshad@example.test', role: 'readonly' };   // what the User tab used to mint
  const session = effectiveSession(raw, true);                                // same override as readSession
  assert.equal(session.role, 'admin');
  assert.deepEqual(pageGate({ ...GATE, session, pathname: '/users' }), { action: 'next' });
  // without the override this is an explicit forbidden page, never a silent /dashboard bounce
  assert.deepEqual(pageGate({ ...GATE, session: raw, pathname: '/users' }), { action: 'forbidden' });
});

test('REGRESSION: Users never depends on application-access data: admin with no apps claim / no grants still opens it', () => {
  assert.deepEqual(pageGate({ ...GATE, session: { sub: 'a1', role: 'admin' }, pathname: '/users' }), { action: 'next' });
  assert.deepEqual(pageGate({ ...GATE, session: { sub: 'a1', role: 'admin', apps: [] }, pathname: '/users' }), { action: 'next' });
});

test('page gate: non-admins get forbidden (never a dashboard bounce); app access is enforced first; login/legacy rules', () => {
  const ro = apps => ({ sub: 'v1', role: 'readonly', ...(apps ? { apps } : {}) });
  assert.deepEqual(pageGate({ ...GATE, session: ro(['cars']), pathname: '/users' }), { action: 'forbidden' });
  assert.deepEqual(pageGate({ ...GATE, session: ro(['cars']), pathname: '/dashboard' }), { action: 'next' });
  assert.deepEqual(pageGate({ ...GATE, session: ro(['inventory']), pathname: '/dashboard' }), { action: 'no-access' });
  assert.deepEqual(pageGate({ ...GATE, session: ro(null), pathname: '/dashboard' }), { action: 'next' });                 // legacy app cookie
  assert.deepEqual(pageGate({ ...GATE, session: ro(null), viaSso: true, pathname: '/dashboard' }), { action: 'no-access' }); // legacy SSO token
  assert.deepEqual(pageGate({ ...GATE, session: null, pathname: '/users' }), { action: 'login' });
  assert.deepEqual(pageGate({ ...GATE, session: { role: 'admin' }, pathname: '/login' }), { action: 'dashboard' });
  assert.deepEqual(pageGate({ ...GATE, session: null, pathname: '/login' }), { action: 'next' });
  assert.deepEqual(pageGate({ ...GATE, session: ro(['cars']), pathname: '/users-report' }), { action: 'next' });          // prefix must be a path segment
});

test('grant diff: adds/removes exactly the difference, prevents duplicates, rejects unknown apps', () => {
  assert.deepEqual(diffAppGrants(['cars', 'crm'], ['crm', 'inventory', 'inventory']), { add: ['inventory'], remove: ['cars'], apps: ['inventory', 'crm'] });
  assert.deepEqual(diffAppGrants(['cars'], ['cars']), { add: [], remove: [], apps: ['cars'] });
  assert.deepEqual(diffAppGrants([], []), { add: [], remove: [], apps: [] });
  assert.equal(diffAppGrants(['cars'], ['cars', 'website']), null);
  assert.equal(diffAppGrants(['cars'], [42]).add.length, 0);
});

test('middleware check: admin always; apps claim decides; legacy token without claim is "unknown"', () => {
  assert.equal(sessionCanEnterApp({ role: 'admin' }, 'cars'), true);
  assert.equal(sessionCanEnterApp({ role: 'readonly', apps: ['inventory'] }, 'cars'), false);
  assert.equal(sessionCanEnterApp({ role: 'manager', apps: ['cars'] }, 'cars'), true);
  assert.equal(sessionCanEnterApp({ role: 'readonly' }, 'cars'), null);
  assert.equal(sessionCanEnterApp(null, 'cars'), false);
});
