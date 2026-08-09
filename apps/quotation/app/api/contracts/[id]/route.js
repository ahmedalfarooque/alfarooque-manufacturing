'use strict';

/* Single-contract endpoint.
   GET    → full contract (payments, attachments, bank, customer joined)
   PATCH  { ...header, payments? } → update header/clauses/notes; if a
           `payments` array is present, the schedule is re-saved (resolved
           %/amount) via the repo.
   DELETE → soft delete. Write permission required for PATCH/DELETE. */

const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { getDb } = require('@/lib/db');
const repo = require('@/lib/contracts/repo');

export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  try {
    const contract = await repo.getContract(params.id);
    if (!contract) return json({ error: 'Not found' }, 404);
    return json(contract);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function PATCH(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const body = await req.json().catch(() => ({}));
  try {
    const before = await repo.getContract(params.id).catch(() => null);
    const updated = await repo.updateContract(params.id, body, session.sub);
    if (Array.isArray(body.payments)) {
      const total = body.grand_total != null ? body.grand_total : (before ? before.grand_total : 0);
      await repo.savePayments(params.id, total, body.payments);
    }
    await audit(getDb(), 'qt_contracts', params.id, 'update',
      before ? { status: before.status } : null, { keys: Object.keys(body) }, session.sub);
    return json({ ok: true, id: updated.id });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function DELETE(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  try {
    await repo.softDeleteContract(params.id, session.sub);
    await audit(getDb(), 'qt_contracts', params.id, 'delete', null, null, session.sub);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
