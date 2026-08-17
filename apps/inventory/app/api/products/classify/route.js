'use strict';

/* Business-role classification for SmartLife-sourced items — see
   erp_item_business_classification migration comment for why this exists
   and why NOTHING is auto-classified: SmartLife's own `type` field is 96%
   one value across all 2,912 products and `category` is department-level
   (mixes raw and finished items), neither is a safe automatic Material
   vs Finished-Product signal. An admin classifies explicitly; this is
   that write path. Classification never touches SmartLife — it's a
   purely local AL FAROOQUE judgment about a read-only source record. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

const ROLES = ['unclassified', 'material', 'finished_product', 'resale_product', 'hybrid', 'service'];

export async function POST(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const sourceRecordId = String(body.source_record_id || '').trim();
  const businessRole = String(body.business_role || '').trim();
  if (!sourceRecordId) return json({ error: 'source_record_id is required.' }, 400);
  if (!ROLES.includes(businessRole)) return json({ error: `business_role must be one of: ${ROLES.join(', ')}` }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('erp_item_business_classification').upsert({
    source_system: 'smartlife',
    source_record_id: sourceRecordId,
    business_role: businessRole,
    classified_by: session.sub,
    classified_at: new Date().toISOString(),
    notes: body.notes || null,
  }, { onConflict: 'source_system,source_record_id' }).select().single();
  if (error) return json({ error: 'Could not save classification.' }, 500);
  return json({ classification: data });
}

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('erp_item_business_classification').select('*').eq('source_system', 'smartlife');
  if (error) return json({ error: 'Could not load classifications.' }, 500);
  return json({ classifications: data || [] });
}
