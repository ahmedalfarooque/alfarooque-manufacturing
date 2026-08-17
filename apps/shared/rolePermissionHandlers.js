'use strict';

const { APPS, ROLES, modulesFor, defaultPermission } = require('./permissionRegistry');
const { effectiveMatrix } = require('./moduleAuthorization');

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }); }

function createRolePermissionHandlers({ getDb, readSession, appId }) {
  async function GET(req, { params }) {
    const session = readSession(req);
    if (!session) return json({ error: 'Not authenticated.' }, 401);
    if (session.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const role = params.role;
    if (!APPS.includes(appId) || !ROLES.includes(role)) return json({ error: 'Unknown role or application.' }, 404);
    const sb = getDb();
    const { data, error } = await sb.from('erp_role_permissions').select('module_id,can_view,can_add,can_edit,can_delete,miscellaneous').eq('app_id', appId).eq('role', role);
    // The permanent migration may be awaiting deployment approval. Defaults
    // remain readable, but PUT below never pretends persistence succeeded.
    if (error && !String(error.message || '').includes('erp_role_permissions')) return json({ error: error.message }, 500);
    const saved = new Map((data || []).map(row => [row.module_id, row]));
    return json({
      app_id: appId, role,
      storage_ready: !error,
      permissions: modulesFor(appId).map(module => {
        const row = saved.get(module.id);
        const permission = row ? { view: row.can_view, add: row.can_add, edit: row.can_edit, delete: row.can_delete, miscellaneous: row.miscellaneous || {} } : defaultPermission(role, appId, module.id);
        return { ...module, ...permission, saved: !!row };
      }),
    });
  }

  async function PUT(req, { params }) {
    const session = readSession(req);
    if (!session) return json({ error: 'Not authenticated.' }, 401);
    if (session.role !== 'admin') return json({ error: 'Admin access required.' }, 403);
    const role = params.role;
    if (!ROLES.includes(role)) return json({ error: 'Unknown role.' }, 404);
    const body = await req.json().catch(() => ({}));
    if (!Array.isArray(body.permissions)) return json({ error: 'permissions is required.' }, 400);
    const known = new Set(modulesFor(appId).map(module => module.id));
    const rows = body.permissions.filter(row => known.has(row.module_id)).map(row => ({
      app_id: appId, role, module_id: row.module_id,
      can_view: !!row.view, can_add: !!row.add, can_edit: !!row.edit, can_delete: !!row.delete,
      miscellaneous: row.miscellaneous && typeof row.miscellaneous === 'object' ? row.miscellaneous : {},
      updated_by: session.sub, updated_at: new Date().toISOString(),
    }));
    if (rows.length !== known.size) return json({ error: 'Every application module must be supplied.' }, 400);
    const { error } = await getDb().from('erp_role_permissions').upsert(rows, { onConflict: 'app_id,role,module_id' });
    if (error && String(error.message || '').includes('erp_role_permissions')) {
      return json({ error: 'Role permission storage is not deployed. Apply the approved shared permission migration first.' }, 503);
    }
    if (error) return json({ error: error.message }, 500);
    return json({ ok: true });
  }

  async function MY(req) {
    const session = readSession(req);
    if (!session) return json({ error: 'Not authenticated.' }, 401);
    return json({ app_id: appId, role: session.role, modules: await effectiveMatrix(getDb(), session, appId) });
  }

  return { GET, PUT, MY };
}

module.exports = { createRolePermissionHandlers };
