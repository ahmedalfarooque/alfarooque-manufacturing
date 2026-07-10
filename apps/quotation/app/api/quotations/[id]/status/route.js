'use strict';

/* Status transitions (Phase 3 subset). Body { action }:
   submit  draft → approved (within thresholds) | pending_approval
   approve pending_approval → approved            (admin — full UI in P4)
   reject  pending_approval → draft (with reason)
   accept  approved|sent → accepted (+won reason)
   decline approved|sent → rejected (+lost reason)
   cancel  any pre-accepted → cancelled                                  */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { getThresholds, logEvent } = require('@/lib/quotes');

export async function POST(req, { params }) {
  const { session, response, qrole } = await requireWrite(req);
  if (!session) return response;
  /* Approvals need the 'approve' permission (admin/manager roles). */
  const { can } = require('@/lib/perms');
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const action = body.action;

  const { data: qn } = await sb.from('qt_quotations').select('*').eq('id', params.id).is('deleted_at', null).single();
  if (!qn) return json({ error: 'Not found' }, 404);

  let next = null;
  let detail = {};

  if (action === 'submit') {
    if (qn.status !== 'draft') return json({ error: 'Only drafts can be submitted.' }, 409);
    const th = await getThresholds(sb);
    const discountPct = qn.discount_type === 'pct'
      ? Number(qn.discount_value)
      : (Number(qn.subtotal) > 0 ? Number(qn.discount_amount) / Number(qn.subtotal) * 100 : 0);
    const reasons = [];
    if (Number(qn.grand_total) >= Number(th.amount)) reasons.push('amount');
    if (qn.blended_margin_pct != null && Number(qn.blended_margin_pct) < Number(th.min_margin_pct)) reasons.push('margin');
    if (discountPct > Number(th.max_discount_pct)) reasons.push('discount');
    if (reasons.length) {
      next = 'pending_approval';
      detail = { reasons, thresholds: th };
      await sb.from('qt_quotation_approvals').insert({ quotation_id: params.id, requested_by: session.sub });
    } else {
      next = 'approved';
      detail = { auto: true };
    }
  } else if (action === 'approve') {
    if (!can(qrole, 'approve')) return json({ error: 'Your role cannot approve quotations.' }, 403);
    if (qn.status !== 'pending_approval') return json({ error: 'Not pending approval.' }, 409);
    next = 'approved';
    await sb.from('qt_quotation_approvals').update({ approver_id: session.sub, status: 'approved', decided_at: new Date().toISOString() })
      .eq('quotation_id', params.id).eq('status', 'pending');
  } else if (action === 'reject') {
    if (!can(qrole, 'approve')) return json({ error: 'Your role cannot reject approvals.' }, 403);
    if (qn.status !== 'pending_approval') return json({ error: 'Not pending approval.' }, 409);
    next = 'draft';
    detail = { reason: body.reason || null };
    await sb.from('qt_quotation_approvals').update({ approver_id: session.sub, status: 'rejected', reason: body.reason || null, decided_at: new Date().toISOString() })
      .eq('quotation_id', params.id).eq('status', 'pending');
  } else if (action === 'accept') {
    if (!['approved', 'sent'].includes(qn.status)) return json({ error: 'Quotation must be approved or sent first.' }, 409);
    next = 'accepted';
    detail = { reason: body.reason || null };
  } else if (action === 'decline') {
    if (!['approved', 'sent'].includes(qn.status)) return json({ error: 'Quotation must be approved or sent first.' }, 409);
    next = 'rejected';
    detail = { reason: body.reason || null, competitor: body.competitor || null };
  } else if (action === 'cancel') {
    if (['accepted', 'cancelled', 'superseded'].includes(qn.status)) return json({ error: 'Cannot cancel in status ' + qn.status }, 409);
    next = 'cancelled';
  } else {
    return json({ error: 'Unknown action.' }, 400);
  }

  const patch = { status: next, updated_by: session.sub, updated_at: new Date().toISOString() };
  if (action === 'accept' || action === 'decline') { patch.won_lost_reason = body.reason || null; patch.competitor = body.competitor || null; }
  const { error } = await sb.from('qt_quotations').update(patch).eq('id', params.id);
  if (error) return json({ error: error.message }, 500);

  await logEvent(sb, params.id, action, detail, session.sub);
  await audit(sb, 'qt_quotations', params.id, 'status', { status: qn.status }, { status: next, ...detail }, session.sub);
  return json({ status: next, detail });
}
