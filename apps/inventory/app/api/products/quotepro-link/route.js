'use strict';

/* Connects an operational item (SmartLife-sourced, classified as
   'material') to an existing QuotePro Material — the relationship
   requested in the corrected business model: operational purchased
   material ↔ QuotePro manufacturing Material are related but NOT the
   same table. Reuses the existing generic canonical mapping
   (erp_master_data_mappings) rather than a new table. Never creates a
   QuotePro Material automatically — an admin picks an existing one
   (search) or explicitly creates a new one there; this route only
   records/updates the relationship. QuotePro's own Materials
   table/UI/API are never modified by this file beyond the deliberate,
   explicit "push current price" action in push-price/route.js, which
   reuses QuotePro's own existing price-history-preserving PATCH. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { parseCookies } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');

function quotationBase() { return (process.env.QUOTATION_API_URL || 'http://localhost:3030').replace(/\/$/, ''); }

/* Search existing QuotePro materials by name/code — read-only proxy,
   reuses QuotePro's own /api/materials list endpoint so this never
   duplicates that search logic. Requires the caller to have an active
   SSO session shared across the six apps; if absent, search simply
   returns no candidates rather than failing the whole request. */
export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const sourceRecordId = searchParams.get('source_record_id') || '';

  const sb = getDb();
  const { data: existingLink } = sourceRecordId
    ? await sb.from('erp_master_data_mappings').select('*').eq('source_system', 'smartlife').eq('source_resource', 'products').eq('source_record_id', sourceRecordId).eq('entity_kind', 'material').maybeSingle()
    : { data: null };

  let candidates = [];
  const ssoToken = parseCookies(req.headers.get('cookie'))[SSO_COOKIE_NAME];
  if (q.trim() && ssoToken) {
    try {
      const res = await fetch(`${quotationBase()}/api/materials?q=${encodeURIComponent(q)}&page=1`, {
        headers: { Cookie: `${SSO_COOKIE_NAME}=${ssoToken}` }, cache: 'no-store',
      });
      if (res.ok) { const d = await res.json().catch(() => ({})); candidates = d.rows || []; }
    } catch (_) { /* QuotePro unreachable — return no candidates, not an error */ }
  }
  return json({ link: existingLink || null, candidates });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'edit');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  const sourceRecordId = String(body.source_record_id || '').trim();
  const qtMaterialId = String(body.qt_material_id || '').trim();
  if (!sourceRecordId || !qtMaterialId) return json({ error: 'source_record_id and qt_material_id are required.' }, 400);

  const sb = getDb();
  /* Unique(source_system, source_resource, source_record_id) on the
     mapping table means this upsert can never create a second link for
     the same operational item — relinking updates the same row. */
  const { data, error } = await sb.from('erp_master_data_mappings').upsert({
    entity_kind: 'material',
    canonical_table: 'qt_materials',
    canonical_id: qtMaterialId,
    source_system: 'smartlife',
    source_resource: 'products',
    source_record_id: sourceRecordId,
    match_method: 'manual',
    created_by: session.sub,
  }, { onConflict: 'source_system,source_resource,source_record_id' }).select().single();
  if (error) return json({ error: 'Could not save the QuotePro Material link.' }, 500);
  return json({ link: data });
}

export async function DELETE(req) {
  const { response } = await requireAction(req, 'edit');
  if (response) return response;
  const { searchParams } = new URL(req.url);
  const sourceRecordId = searchParams.get('source_record_id') || '';
  if (!sourceRecordId) return json({ error: 'source_record_id is required.' }, 400);
  const sb = getDb();
  const { error } = await sb.from('erp_master_data_mappings').delete()
    .eq('source_system', 'smartlife').eq('source_resource', 'products').eq('source_record_id', sourceRecordId).eq('entity_kind', 'material');
  if (error) return json({ error: 'Could not remove the link.' }, 500);
  return json({ ok: true });
}
