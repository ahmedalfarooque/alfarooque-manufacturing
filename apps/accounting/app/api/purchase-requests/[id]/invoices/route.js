'use strict';

/* Connects/disconnects a Purchase Request to an existing SmartERP Purchase
   Invoice snapshot (erp_financial_source_records, record_type =
   'purchase_invoice'). Reuses the existing erp_financial_connections table
   — one row per source_record_id (its real UNIQUE constraint), which may
   also carry a project_id independently. Never touches SmartERP: this only
   ever reads/writes the local snapshot + connection row. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { normalizeSmartErpFinancialRecord } = require('../../../../../../shared/financialRecords');

export async function POST(req, { params }) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const sb = getDb();

  const { data: pr } = await sb.from('pm_purchase_requests').select('id').eq('id', params.id).maybeSingle();
  if (!pr) return json({ error: 'Purchase request not found.' }, 404);

  /* Two ways to identify the invoice: an already-resolved internal
     source_record_id, or (matching the existing relationships route's own
     convention) the raw SmartERP purchase record straight from the
     /api/smartlife/purchases list — upserted into the same snapshot table
     the sync job writes to, never touching SmartERP itself. */
  let sourceRecordId = body.source_record_id;
  if (!sourceRecordId && body.source_record) {
    const row = normalizeSmartErpFinancialRecord('purchases', body.source_record);
    if (!row) return json({ error: 'Could not read this SmartERP purchase record.' }, 400);
    const { data: upserted, error: upsertErr } = await sb.from('erp_financial_source_records')
      .upsert(row, { onConflict: 'tenant_id,source_system,record_type,external_id', ignoreDuplicates: false })
      .select('id').single();
    if (upsertErr) return json({ error: 'Could not save the SmartERP purchase snapshot.' }, 500);
    sourceRecordId = upserted.id;
  }
  if (!sourceRecordId) return json({ error: 'source_record_id or source_record is required.' }, 400);

  const { data: source } = await sb.from('erp_financial_source_records').select('id, record_type, external_id').eq('id', sourceRecordId).maybeSingle();
  if (!source) return json({ error: 'SmartERP source record not found. Sync it first.' }, 404);
  if (source.record_type !== 'purchase_invoice') return json({ error: 'Only Purchase Invoices can be connected to a Purchase Request.' }, 400);

  const { data: existingLink } = await sb.from('erp_financial_connections').select('id, purchase_request_id').eq('tenant_id', 'alfarooque').eq('source_record_id', sourceRecordId).maybeSingle();
  if (existingLink?.purchase_request_id === params.id) {
    return json({ ok: true, alreadyConnected: true, connectionId: existingLink.id });
  }
  /* The existing table stores exactly one purchase_request_id per invoice
     row — connecting to a second request while one is already set would
     silently overwrite it, so this is treated as a real conflict rather
     than a silent duplicate/replace. */
  if (existingLink?.purchase_request_id) {
    return json({ error: 'This Purchase Invoice is already connected to a different Purchase Request. Disconnect it first.' }, 409);
  }

  const relationship = {
    tenant_id: 'alfarooque',
    source_record_id: sourceRecordId,
    purchase_request_id: params.id,
    workflow_status: existingLink ? undefined : 'connected',
    created_by: session.sub,
    updated_at: new Date().toISOString(),
  };
  Object.keys(relationship).forEach(k => relationship[k] === undefined && delete relationship[k]);

  const { data: connection, error } = await sb.from('erp_financial_connections')
    .upsert(relationship, { onConflict: 'tenant_id,source_record_id', ignoreDuplicates: false })
    .select().single();
  if (error) { console.error('[purchase-requests invoices] connect failed:', error.message); return json({ error: 'Could not connect the purchase invoice.' }, 500); }
  return json({ ok: true, connection });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const url = new URL(req.url);
  const sourceRecordId = url.searchParams.get('source_record_id');
  if (!sourceRecordId) return json({ error: 'source_record_id is required.' }, 400);
  const sb = getDb();

  const { data: link } = await sb.from('erp_financial_connections').select('id, project_id, purchase_order_id, goods_receipt_id').eq('tenant_id', 'alfarooque').eq('source_record_id', sourceRecordId).eq('purchase_request_id', params.id).maybeSingle();
  if (!link) return json({ error: 'No such connection.' }, 404);

  /* The row's CHECK constraint requires at least one of project_id /
     purchase_request_id / purchase_order_id / goods_receipt_id to remain
     set. If this was the only reason the row existed, delete the row
     instead of updating it to an all-null state that would violate that
     constraint — otherwise just clear purchase_request_id and keep the
     project<->invoice link (if any) intact. */
  if (!link.project_id && !link.purchase_order_id && !link.goods_receipt_id) {
    const { error } = await sb.from('erp_financial_connections').delete().eq('id', link.id);
    if (error) return json({ error: 'Could not disconnect the purchase invoice.' }, 500);
    return json({ ok: true, connectionRemoved: true });
  }
  const { error } = await sb.from('erp_financial_connections').update({ purchase_request_id: null, updated_at: new Date().toISOString() }).eq('id', link.id);
  if (error) return json({ error: 'Could not disconnect the purchase invoice.' }, 500);
  return json({ ok: true });
}
