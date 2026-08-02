'use strict';

/* Shared cross-app permissions — gates which of the 6 ERP apps a user's
   Application Switcher shows. Mirrored across every app (identical file):
   apps/quotation, apps/projects, apps/cars, apps/inventory,
   apps/accounting, apps/crm.

   GET  (any authenticated user)         -> { apps: [...] } for the caller
   GET  ?user_id=<id> (admin only)       -> { apps: [...] } for that user
   POST { user_id, apps: [...] } (admin) -> replaces that user's full grant list

   Admins and the super-admin account always see every app — enforced by
   readSession's isSuperAdminEmail override plus the admin check below —
   so this table only ever restricts non-admin users. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const ALL_APPS = ['quotation', 'projects', 'cars', 'inventory', 'accounting', 'crm'];

export async function GET(req) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('user_id');

  if (targetUserId && targetUserId !== session.sub) {
    if (session.role !== 'admin') return json({ error: 'Admin only.' }, 403);
    const sb = getDb();
    const { data } = await sb.from('app_permissions').select('app_id').eq('user_id', targetUserId);
    return json({ apps: (data || []).map(r => r.app_id) });
  }

  if (session.role === 'admin') return json({ apps: ALL_APPS });

  const sb = getDb();
  const { data } = await sb.from('app_permissions').select('app_id').eq('user_id', session.sub);
  return json({ apps: (data || []).map(r => r.app_id) });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const userId = body.user_id;
  const apps = Array.isArray(body.apps) ? body.apps.filter(a => ALL_APPS.includes(a)) : [];
  if (!userId) return json({ error: 'user_id is required.' }, 400);

  const sb = getDb();
  await sb.from('app_permissions').delete().eq('user_id', userId);
  if (apps.length > 0) {
    await sb.from('app_permissions').insert(apps.map(app_id => ({ user_id: userId, app_id, granted_by: session.sub })));
  }

  return json({ ok: true, apps });
}
