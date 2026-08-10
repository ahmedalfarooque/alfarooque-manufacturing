'use strict';

/* Explicit quotation workflow. Submission creates one idempotent Quotation
   approval request. Customer decisions are impossible until Quotation has
   approved. Contracting creates/links exactly one project automatically. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { logEvent } = require('@/lib/quotes');
const { nextQuotationStatus } = require('@/lib/quotationWorkflow');
const { ensureQuotationApprovalRequest, createProjectForQuotation } = require('../../../../../../shared/quotationProjectWorkflow');

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
    next = nextQuotationStatus(qn.status, action);
    if (!next) return json({ error: 'Only drafts can be submitted.' }, 409);
    try {
      const request = await ensureQuotationApprovalRequest(sb, qn, session.sub);
      detail = { request_id: request.row.id, request_created: request.created, department: 'Quotation' };
      qn.project_request_id = request.row.id;
      const { data: admins } = await sb.from('platform_users').select('id').eq('role', 'admin').eq('is_active', true);
      if (admins?.length) {
        const { error: notificationError } = await sb.from('notifications').insert(admins.map(user => ({
          user_id: user.id, type: 'quotation_request', title: 'Quotation waiting for approval.',
          body: `Quotation ${qn.quote_number} requires Quotation Approval.`, link: '/quotation-requests/' + request.row.id,
        })));
        if (notificationError) console.warn('[quotation-workflow] notification skipped:', notificationError.message);
      }
    } catch (error) {
      console.error('[quotation-workflow] approval request failed:', error.message);
      const conflict = /Only drafts|already/i.test(error.message || '');
      return json({ error: error.message || 'Could not create the Quotation Approval request. The quotation was not submitted.' }, conflict ? 409 : 500);
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
    next = nextQuotationStatus(qn.status, action);
    if (!next) return json({ error: 'Quotation Approval is required before customer approval.' }, 409);
    detail = { reason: body.reason || null };
  } else if (action === 'decline') {
    next = nextQuotationStatus(qn.status, action);
    if (!next) return json({ error: 'Quotation Approval is required before a customer decision.' }, 409);
    detail = { reason: body.reason || null, competitor: body.competitor || null };
  } else if (action === 'cancel') {
    if (['accepted', 'cancelled', 'superseded'].includes(qn.status)) return json({ error: 'Cannot cancel in status ' + qn.status }, 409);
    next = 'cancelled';
  } else if (action === 'contract') {
    next = nextQuotationStatus(qn.status, action);
    if (!next) return json({ error: 'Customer approval is required before contracting.' }, 409);
    try {
      const result = await createProjectForQuotation(sb, params.id);
      detail = { contracted: true, project_id: result.project.id, project_created: result.created };
    } catch (error) {
      console.error('[quotation-workflow] automatic project creation failed:', error.message);
      return json({ error: error.message || 'Could not create the linked project. The quotation remains Customer Approved.' }, 500);
    }
  } else if (action === 'start') {
    return json({ error: 'Projects are created automatically when a quotation is contracted.' }, 409);
  } else {
    return json({ error: 'Unknown action.' }, 400);
  }

  const patch = { status: next, updated_by: session.sub, updated_at: new Date().toISOString() };
  if (action === 'submit') { patch.project_status = 'pending'; patch.project_request_id = qn.project_request_id; }
  if (action === 'accept' || action === 'decline') {
    patch.won_lost_reason = body.reason || null;
    patch.competitor = body.competitor || null;
    if (action === 'decline') {
      patch.rejection_reason = body.reason || null;
      patch.rejected_by = session.sub;
    }
  }
  /* Submission was already committed atomically by the RPC. Other actions
     remain single-row transitions here. */
  const { error } = action === 'submit'
    ? { error: null }
    : await sb.from('qt_quotations').update(patch).eq('id', params.id);
  if (error) return json({ error: error.message }, 500);

  await logEvent(sb, params.id, action, detail, session.sub);
  await audit(sb, 'qt_quotations', params.id, 'status', { status: qn.status }, { status: next, ...detail }, session.sub);
  return json({ status: next, detail });
}
