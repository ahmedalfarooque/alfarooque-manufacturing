'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   SHARED SmartLife DOCUMENT RESOLVER — sales invoices & purchases
   ═══════════════════════════════════════════════════════════════════════

   One resolution order used by every document surface (modal, print page,
   server PDF, ZATCA QR), so a record that opens on one surface can never be
   "not found" on another — which is exactly the bug this replaces:
   /smartlife/purchases/2036/print reported "This purchase was not found."
   because it only ever consulted the LIST endpoint (and the local snapshot
   behind it), while SmartERP's own detail endpoint has the record.

   Order:
     1. the local synchronized snapshot (fast, no network)
     2. SmartERP's verified detail endpoint, via the existing central
        `?detail_id=` parameter (purchase/get_purchase/{id},
        sales/get_sale/{id}) — proven live to return the full document
        including its line items
     3. the list endpoint as a last resort, for a record identified by its
        reference rather than its numeric id

   A failure at step 2 or 3 is never reported as "record does not exist" —
   the caller receives the distinction so an API outage cannot be mistaken
   for a missing document. */

const { getDb } = require('@/lib/db');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { readSmartLife } = require('@/lib/smartlife');

const RECORD_TYPES = { 'sales-invoices': 'sales_invoice', purchases: 'purchase_invoice' };
const ID_KEYS = ['id', 'invoice_id', 'reference_no', 'invoice_number', 'number', 'reference'];

function matchesId(record, id) {
  return ID_KEYS.some(key => String(record?.[key] ?? '') === String(id));
}

function credentialsFrom(req) {
  const cookies = parseCookies(req.headers.get('cookie'));
  return { appToken: cookies[COOKIE_NAME], ssoToken: cookies[SSO_COOKIE_NAME] };
}

async function fromLocalSnapshot(resource, id) {
  const recordType = RECORD_TYPES[resource];
  if (!recordType) return null;
  const { data, error } = await getDb().from('erp_financial_source_records')
    .select('raw_payload')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('record_type', recordType)
    .eq('external_id', String(id))
    .maybeSingle();
  if (error || !data?.raw_payload) return null;
  return data.raw_payload;
}

async function fromDetailEndpoint(req, resource, id) {
  if (!/^\d+$/.test(String(id))) return { record: null, failed: false };
  try {
    const result = await readSmartLife(resource, credentialsFrom(req), { detail_id: String(id) });
    const record = result?.providerPayload?.record || null;
    return { record: record && typeof record === 'object' ? record : null, failed: false };
  } catch (_) {
    /* Transport/permission failure — explicitly NOT "does not exist". */
    return { record: null, failed: true };
  }
}

async function fromListEndpoint(req, resource, id) {
  try {
    const result = await readSmartLife(resource, credentialsFrom(req), { search: String(id), limit: '100' });
    return { record: (result.records || []).find(record => matchesId(record, id)) || null, failed: false };
  } catch (error) {
    const records = Array.isArray(error?.centralPayload?.records) ? error.centralPayload.records : [];
    const found = records.find(record => matchesId(record, id)) || null;
    return { record: found, failed: !found };
  }
}

/* Returns { record, source, liveFailed }. `record` is null only when every
   consulted source genuinely had no such document. */
async function resolveSmartLifeDocument(req, resource, id) {
  const local = await fromLocalSnapshot(resource, id).catch(() => null);
  if (local) return { record: local, source: 'synchronized-snapshot', liveFailed: false };

  const detail = await fromDetailEndpoint(req, resource, id);
  if (detail.record) return { record: detail.record, source: 'smarterp-detail', liveFailed: false };

  const list = await fromListEndpoint(req, resource, id);
  if (list.record) return { record: list.record, source: 'smarterp-list', liveFailed: false };

  return { record: null, source: null, liveFailed: detail.failed || list.failed };
}

module.exports = { resolveSmartLifeDocument, matchesId, credentialsFrom };
