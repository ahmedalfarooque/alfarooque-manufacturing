'use strict';

/* Shared admin-users handlers, exercised against an in-memory stand-in
   for the Supabase client. Covers the authorization gate and the exact
   mutations the Users page issues (assign role = upsert grant, revoke =
   delete grant), so the write path is verified without touching the
   shared database. */

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminUsersHandlers } = require('./userAdminHandlers');

/* Minimal chainable fake: records every call, answers from `tables`. */
function fakeDb(tables) {
  const calls = [];
  const from = table => {
    const state = { table, op: 'select', filters: [], payload: null };
    const rows = () => (tables[table] || []).filter(r => state.filters.every(([k, v]) => String(r[k]) === String(v)));
    const run = () => {
      calls.push({ ...state });
      if (state.op === 'select') return { data: rows(), error: null };
      if (state.op === 'upsert') { tables[table] = [...(tables[table] || []).filter(r => !(r.user_id === state.payload.user_id && r.app_id === state.payload.app_id)), { ...(tables[table] || []).find(r => r.user_id === state.payload.user_id && r.app_id === state.payload.app_id), ...state.payload }]; return { data: null, error: null }; }
      if (state.op === 'update') { for (const r of rows()) Object.assign(r, state.payload); return { data: null, error: null }; }
      if (state.op === 'delete') { const keep = rows(); tables[table] = (tables[table] || []).filter(r => !keep.includes(r)); return { data: null, error: null }; }
      return { data: null, error: null };
    };
    const b = {
      select() { return b; }, order() { return b; },
      eq(k, v) { state.filters.push([k, v]); return b; },
      upsert(p) { state.op = 'upsert'; state.payload = p; return b; },
      update(p) { state.op = 'update'; state.payload = p; return b; },
      delete() { state.op = 'delete'; return b; },
      maybeSingle() { const r = run(); return Promise.resolve({ data: r.data ? r.data[0] || null : null, error: r.error }); },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return b;
  };
  return { from, calls, tables };
}

const req = (body, cookie = 'admin') => ({
  json: async () => body,
  headers: { get: () => cookie },
  url: 'http://localhost/api/admin/users',
});
const sessions = { admin: { sub: 'a1', email: 'admin@x.test', role: 'admin' }, viewer: { sub: 'v1', email: 'v@x.test', role: 'viewer' }, '': null };
const readSession = r => sessions[r.headers.get()] ?? null;

function setup() {
  const db = fakeDb({
    platform_users: [
      { id: 'a1', email: 'admin@x.test', full_name: 'Admin', role: 'admin', is_active: true, is_approved: true },
      { id: 'v1', email: 'v@x.test', full_name: 'Viewer', role: 'viewer', is_active: true, is_approved: true },
    ],
    app_permissions: [{ user_id: 'a1', app_id: 'quotation', app_role: 'admin', module_access: {}, can_delete: true }],
  });
  return { db, h: createAdminUsersHandlers({ getDb: () => db, readSession, appId: 'cars' }) };
}

test('GET: anonymous 401, viewer 403, admin sees has_app_access per user', async () => {
  const { h } = setup();
  assert.equal((await h.GET(req({}, ''))).status, 401);
  assert.equal((await h.GET(req({}, 'viewer'))).status, 403);
  const res = await h.GET(req({}));
  assert.equal(res.status, 200);
  const body = await res.json();
  const byId = Object.fromEntries(body.rows.map(r => [r.id, r]));
  assert.equal(byId.a1.has_app_access, true);   // platform admin
  assert.equal(byId.v1.has_app_access, false);  // no cars grant
  assert.equal(byId.v1.app_role, 'readonly');
  assert.ok(body.modules.some(m => m.id === 'insurance') && body.modules.some(m => m.id === 'inspection'));
});

test('PATCH role: viewer 403, anonymous 401, unknown role 400', async () => {
  const { h } = setup();
  assert.equal((await h.PATCH(req({ user_id: 'v1', app_id: 'cars', role: 'manager' }, 'viewer'))).status, 403);
  assert.equal((await h.PATCH(req({ user_id: 'v1', app_id: 'cars', role: 'manager' }, ''))).status, 401);
  assert.equal((await h.PATCH(req({ user_id: 'v1', app_id: 'cars', role: 'owner' }))).status, 400);
  assert.equal((await h.PATCH(req({ user_id: 'v1', app_id: 'nope', role: 'manager' }))).status, 400);
});

test('assign Cars role creates the grant; GET then reports access; refresh-safe (stored row)', async () => {
  const { h, db } = setup();
  const res = await h.PATCH(req({ user_id: 'v1', app_id: 'cars', role: 'manager' }));
  assert.equal(res.status, 200);
  const grant = db.tables.app_permissions.find(r => r.user_id === 'v1' && r.app_id === 'cars');
  assert.deepEqual({ app_role: grant.app_role, granted_by: grant.granted_by }, { app_role: 'manager', granted_by: 'a1' });
  const up = db.calls.find(c => c.op === 'upsert');
  assert.equal(up.table, 'app_permissions');
  const rows = (await (await h.GET(req({}))).json()).rows;
  const v = rows.find(r => r.id === 'v1');
  assert.deepEqual([v.has_app_access, v.app_role], [true, 'manager']);
  // re-assigning a different role updates the same grant, no duplicate row
  await h.PATCH(req({ user_id: 'v1', app_id: 'cars', role: 'readonly' }));
  assert.equal(db.tables.app_permissions.filter(r => r.user_id === 'v1' && r.app_id === 'cars').length, 1);
});

test('revoke Cars access deletes only that grant; other apps untouched; GET reports no access', async () => {
  const { h, db } = setup();
  await h.PATCH(req({ user_id: 'v1', app_id: 'cars', role: 'manager' }));
  await h.PATCH(req({ user_id: 'v1', app_id: 'projects', role: 'readonly' }));
  const res = await h.PATCH(req({ user_id: 'v1', app_id: 'cars', revoke_app: true }));
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true, revoked: 'cars' });
  assert.equal(db.tables.app_permissions.some(r => r.user_id === 'v1' && r.app_id === 'cars'), false);
  assert.equal(db.tables.app_permissions.some(r => r.user_id === 'v1' && r.app_id === 'projects'), true);
  const v = (await (await h.GET(req({}))).json()).rows.find(r => r.id === 'v1');
  assert.deepEqual([v.has_app_access, v.app_role], [false, 'readonly']);
});

test('revoke guards: self 400, platform admin 400, unknown user 404, viewer 403', async () => {
  const { h } = setup();
  assert.equal((await h.PATCH(req({ user_id: 'a1', app_id: 'cars', revoke_app: true }))).status, 400);
  const { h: h2 } = setup();
  const adminTarget = createAdminUsersHandlers({ getDb: () => h2 && setup().db, readSession: () => ({ sub: 'other', role: 'admin' }), appId: 'cars' });
  assert.equal((await adminTarget.PATCH(req({ user_id: 'a1', app_id: 'cars', revoke_app: true }))).status, 400);
  assert.equal((await h.PATCH(req({ user_id: 'ghost', app_id: 'cars', revoke_app: true }))).status, 404);
  assert.equal((await h.PATCH(req({ user_id: 'v1', app_id: 'cars', revoke_app: true }, 'viewer'))).status, 403);
});

test('activate / deactivate updates platform_users.is_active', async () => {
  const { h, db } = setup();
  assert.equal((await h.PATCH(req({ user_id: 'v1', is_active: false }))).status, 200);
  assert.equal(db.tables.platform_users.find(u => u.id === 'v1').is_active, false);
  await h.PATCH(req({ user_id: 'v1', is_active: true }));
  assert.equal(db.tables.platform_users.find(u => u.id === 'v1').is_active, true);
});
