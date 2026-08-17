'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { authorizeAction } = require('./moduleAuthorization');

function db({ user = { is_active: true, is_approved: true }, grant, saved }) {
  return { from(table) {
    return { select() { return this; }, eq() { return this; }, maybeSingle: async () => {
      if (table === 'platform_users') return { data: user };
      if (table === 'app_permissions') return { data: grant };
      return { data: saved };
    } };
  } };
}

test('View Only rejects Add/Edit/Delete at the server authorization layer', async () => {
  const sb = db({ grant: { app_role: 'manager', module_access: { products: 'view_only' } } });
  for (const action of ['add', 'edit', 'delete']) assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', action)).allowed, false);
  assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', 'view')).allowed, true);
});

test('View & Edit permits only View and Edit', async () => {
  const sb = db({ grant: { app_role: 'manager', module_access: { products: 'view_edit' } } });
  assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', 'view')).allowed, true);
  assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', 'edit')).allowed, true);
  assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', 'add')).allowed, false);
  assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', 'delete')).allowed, false);
});

test('Full Access is module-scoped and does not grant Users administration', async () => {
  const sb = db({ grant: { app_role: 'manager', module_access: { products: 'full_access' } } });
  for (const action of ['view', 'add', 'edit', 'delete']) assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'products', action)).allowed, true);
  assert.equal((await authorizeAction(sb, { sub: 'u', role: 'manager' }, 'inventory', 'users', 'view')).allowed, false);
});

test('Admin retains every action', async () => {
  for (const action of ['view', 'add', 'edit', 'delete']) assert.equal((await authorizeAction(db({}), { sub: 'a', role: 'admin' }, 'crm', 'contacts', action)).allowed, true);
});
