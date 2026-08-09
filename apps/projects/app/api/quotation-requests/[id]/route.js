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

  const [{ data: products }, { data: events }] = await Promise.all([
    sb.from('qt_quotation_products').select('id, sort, name, name_en, name_ar, description, description_en, description_ar, qty, unit, unit_price, line_discount, taxable').eq('quotation_id', row.quotation_id).order('sort'),
    sb.from('qt_quotation_events').select('event, detail, actor_id, created_at').eq('quotation_id', row.quotation_id).order('created_at', { ascending: false }).limit(50),
  ]);
  const actorIds = [...new Set((events || []).map(e => e.actor_id).filter(Boolean))];
  const { data: actors } = actorIds.length ? await sb.from('platform_users').select('id, full_name, email').in('id', actorIds) : { data: [] };
  const actorById = new Map((actors || []).map(actor => [actor.id, actor]));

  return json({
    quotationRequest: {
      ...row,
      quotation: row.qt_quotations || null,
      customer: row.customers || null,
      requested_by_name: row.platform_users?.full_name || row.platform_users?.email || null,
      products: products || [],
      history: (events || []).map(e => ({ ...e, actor_name: actorById.get(e.actor_id)?.full_name || actorById.get(e.actor_id)?.email || null })),
      qt_quotations: undefined, customers: undefined, platform_users: undefined,
    },
  });
}

export async function PATCH(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.status || !VALID_STATUSES.includes(body.status)) return json({ error: 'Invalid status.' }, 400);
  const note = String(body.note || '').trim();
  if (['on_hold', 'rejected'].includes(body.status) && !note) return json({ error: 'A reason is required when returning or rejecting a quotation.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('project_requests').select('*').eq('id', params.id).maybeSingle();
  if (!existing) return json({ error: 'Quotation request not found.' }, 404);
  if (existing.project_id) return json({ error: 'A project has already been started from this request — status is locked.' }, 409);
  if (!['pending', 'on_hold'].includes(existing.status)) return json({ error: 'This request has already been decided.' }, 409);
  if (existing.status === 'on_hold' && body.status === 'on_hold') return json({ error: 'This request is already returned.' }, 409);

  const { data: row, error } = await sb.from('project_requests')
    .update({ status: body.status, note: note || existing.note, updated_at: new Date().toISOString() })
    .eq('id', params.id).eq('status', existing.status).select().maybeSingle();
  if (error) { console.error('[quotation-requests] update failed:', error.message); return json({ error: 'Could not update the quotation request.' }, 500); }
  if (!row) return json({ error: 'Another user reviewed this request first. Refresh to see the latest decision.' }, 409);

  /* Sync back to the quotation app — same Postgres instance, direct write. */
  await sb.from('qt_quotations')
    .update({ project_status: body.status, project_request_id: params.id })
    .eq('id', existing.quotation_id);

  const eventName = body.status === 'accepted' ? 'operations_accepted' : body.status === 'rejected' ? 'operations_rejected' : 'operations_returned';
  await sb.from('qt_quotation_events').insert({ quotation_id: existing.quotation_id, event: eventName, detail: { previous_status: existing.status, new_status: body.status, department: 'Operations', reason: note || null, request_id: params.id }, actor_id: session.sub });
  await auditQuotation(sb, 'project_requests', params.id, 'status', { status: existing.status }, { status: body.status, note: note || null, department: 'Operations' }, session.sub);

  if (existing.requested_by) {
    await sb.from('notifications').insert({
      user_id: existing.requested_by,
      type: 'quotation_' + body.status,
      title: NOTIF_TITLE[body.status],
      body: `Quotation ${existing.quote_number}${note ? `\nReason: ${note}` : ''}`,
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
