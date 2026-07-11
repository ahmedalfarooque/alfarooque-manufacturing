'use strict';

/* /api/admin/quotes/delete — POST { id } → SOFT delete only.
   Mirrors api/admin/orders/delete.js exactly: flags is_deleted/deleted_at
   /deleted_by, schedules auto_delete_at 30 days out. Nothing else on the
   row changes, so Recover has nothing to reconstruct. */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../../_adminAuth');
const { RECOVERY_WINDOW_DAYS, sendQuotesError, hasSoftDelete } = require('../../_quotesCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await readJsonBody(req);
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'Missing quote id.' });

  const sb = getAdminClient();
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendQuotesError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Quote not found.' });
  if (existing.is_deleted) return res.status(400).json({ error: 'Quote is already deleted.' });

  const now = new Date();
  const autoDeleteAt = new Date(now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await sb.from('quotes').update({
    is_deleted: true, deleted_at: now.toISOString(), deleted_by: admin.id,
    auto_delete_at: autoDeleteAt.toISOString(), recovered_at: null, recovered_by: null,
  }).eq('id', id).select().single();
  if (error) return sendQuotesError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.delete',
    entityType: 'quote', entityId: id, details: { name: existing.name, email: existing.email }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'quote', title: 'Quote Deleted',
    body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' deleted by ' + (admin.full_name || admin.email) + '.',
    link: '/pages/admin/dashboard.html#quotes-deleted',
  });

  return res.status(200).json({ quote: data });
};
