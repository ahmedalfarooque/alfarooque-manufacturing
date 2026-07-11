'use strict';

/* /api/admin/quotes/recover — POST { id } → moves a quote back from
   Deleted Quotes to Quotes. Mirrors api/admin/orders/recover.js exactly. */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../../_adminAuth');
const { sendQuotesError, hasSoftDelete } = require('../../_quotesCore');

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
  if (!existing.is_deleted) return res.status(400).json({ error: 'Quote is not deleted.' });

  const { data, error } = await sb.from('quotes').update({
    is_deleted: false, recovered_at: new Date().toISOString(), recovered_by: admin.id, auto_delete_at: null,
  }).eq('id', id).select().single();
  if (error) return sendQuotesError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.recover',
    entityType: 'quote', entityId: id, details: { name: existing.name, email: existing.email }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'quote', title: 'Quote Recovered',
    body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' restored successfully.',
    link: '/pages/admin/dashboard.html#quotes',
  });

  return res.status(200).json({ quote: data });
};
