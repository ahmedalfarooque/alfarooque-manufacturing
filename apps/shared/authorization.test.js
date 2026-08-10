'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDeleteAuthorization } = require('./authorization');

function db({ user, grant, userError = null, grantError = null }) {
  return { from(table) {
    const result = table === 'platform_users' ? { data: user, error: userError } : { data: grant, error: grantError };
    const chain = { select: () => chain, eq: () => chain, maybeSingle: async () => result };
    return chain;
  } };
}

test('admin always has delete authorization', async () => {
  assert.equal((await getDeleteAuthorization(db({}), { sub: 'a', role: 'admin' }, 'crm')).allowed, true);
});

test('approved active non-admin requires the explicit app delete grant', async () => {
  const session = { sub: 'u', role: 'viewer' };
  assert.equal((await getDeleteAuthorization(db({ user: { is_active: true, is_approved: true, role: 'viewer' }, grant: { can_delete: true } }), session, 'projects')).allowed, true);
  assert.equal((await getDeleteAuthorization(db({ user: { is_active: true, is_approved: true, role: 'viewer' }, grant: { can_delete: false } }), session, 'projects')).allowed, false);
});

test('unapproved, inactive, and read-only users without a grant are denied', async () => {
  const session = { sub: 'u', role: 'viewer' };
  assert.equal((await getDeleteAuthorization(db({ user: { is_active: true, is_approved: false, role: 'viewer' }, grant: { can_delete: true } }), session, 'cars')).allowed, false);
  assert.equal((await getDeleteAuthorization(db({ user: { is_active: false, is_approved: true, role: 'viewer' }, grant: { can_delete: true } }), session, 'cars')).allowed, false);
  assert.equal((await getDeleteAuthorization(db({ user: { is_active: true, is_approved: true, role: 'viewer' }, grant: null }), session, 'cars')).allowed, false);
});
