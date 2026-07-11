'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { auditQuotation } = require('@/lib/auditQuotation');
const { isSuperAdminEmail } = require('@/lib/superAdmin');

const VALID_STATUSES = ['accepted', 'on_hold', 'rejected'];
const NOTIF_TITLE = { accepted: 'Quotation Accepted', on_hold: 'Quotation Put On Hold', rejected: 'Quotation Rejected' };

export async function GET(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: row, error } = await sb
    .from('project_requests')
    .select('*, qt_quotations!quotation_id(quote_number, status, grand_total, quote_date, customer_notes, output_lang), customers(company_name, company_name_en, company_name_ar, email, mobile_number), platform_users(full_name, email)')
    .eq('id', params.id).maybeSingle();
  if (error) { console.error('[quotation-requests] get failed:', error.message); return json({ error: 'Could not load the quotation request.' }, 500); }
  if (!row) return json({ error: 'Quotation request not found.' }, 404);

  return json({
    quotationRequest: {
      ...row,
      quotation: row.qt_quotations || null,
      customer: row.customers || null,
      requested_by_name: row.platform_users?.full_name || row.platform_users?.email || null,
      qt_quotations: undefined, customers: undefined, platform_users: undefined,
    },
  });
}

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.status || !VALID_STATUSES.includes(body.status)) return json({ error: 'Invalid status.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('project_requests').select('*').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Quotation request not found.' }, 404);
  if (existing.project_id) return json({ error: 'A project has already been started from this request — status is locked.' }, 409);

  const { data: row, error } = await sb.from('project_requests')
    .update({ status: body.status, note: body.note ?? existing.note, updated_at: new Date().toISOString() })
    .eq('id', params.id).select().single();
  if (error) { console.error('[quotation-requests] update failed:', error.message); return json({ error: 'Could not update the quotation request.' }, 500); }

  /* Sync back to the quotation app — same Postgres instance, direct write. */
  await sb.from('qt_quotations')
    .update({ project_status: body.status, project_request_id: params.id })
    .eq('id', existing.quotation_id);

  await auditQuotation(sb, 'project_requests', params.id, 'status', { status: existing.status }, { status: body.status }, session.sub);

  if (existing.requested_by) {
    await sb.from('notifications').insert({
      user_id: existing.requested_by,
      type: 'quotation_' + body.status,
      title: NOTIF_TITLE[body.status],
      body: `Quotation ${existing.quote_number}`,
      link: '/quotations/' + existing.quotation_id,
    }).catch(() => {});
  }

  return json({ quotationRequest: row });
}

export async function DELETE(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: existing } = await sb.from('project_requests').select('status, quote_number').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Quotation request not found.' }, 404);
  if (!isSuperAdminEmail(session.email) && existing.status !== 'pending') {
    return json({ error: 'Only a pending request can be deleted.' }, 409);
  }

  const { error } = await sb.from('project_requests').delete().eq('id', params.id);
  if (error) { console.error('[quotation-requests] delete failed:', error.message); return json({ error: 'Could not delete the quotation request.' }, 500); }
  await auditQuotation(sb, 'project_requests', params.id, 'delete', existing, null, session.sub);
  return json({ ok: true });
}
