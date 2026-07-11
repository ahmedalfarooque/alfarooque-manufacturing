'use strict';

/* /api/admin/quotes/permanent — DELETE ?id=<uuid> → real, irreversible
   DB delete. Super Admin only. Mirrors api/admin/orders/permanent.js
   exactly. Only a row already soft-deleted can be hit by this endpoint. */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, logAudit } = require('../../_adminAuth');
const { isSuperAdmin, sendQuotesError, hasSoftDelete } = require('../../_quotesCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });
  if (!isSuperAdmin(admin)) return res.status(403).json({ error: 'Only a Super Admin can permanently delete a quote.' });

  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const id = query.id;
  if (!id) return res.status(400).json({ error: 'Missing quote id.' });

  const sb = getAdminClient();
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendQuotesError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Quote not found.' });
  if (!existing.is_deleted) return res.status(400).json({ error: 'Only a soft-deleted quote can be permanently deleted.' });

  const { error } = await sb.from('quotes').delete().eq('id', id);
  if (error) return sendQuotesError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.permanent_delete',
    entityType: 'quote', entityId: id, details: { name: existing.name, email: existing.email }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'quote', title: 'Quote Permanently Deleted',
    body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' permanently deleted by ' + (admin.full_name || admin.email) + '.',
    link: '/pages/admin/dashboard.html#quotes-deleted',
  });

  return res.status(200).json({ ok: true });
};
