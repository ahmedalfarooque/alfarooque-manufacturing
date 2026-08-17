'use strict';

const { getDb } = require('@/lib/db');
const { json, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { normalizeSmartLifeMaster } = require('@/lib/smartlifeMasterData');

async function existingLocal(sb, resource, normalized) {
  if (resource === 'customers') {
    if (normalized.email) {
      const { data } = await sb.from('customers').select('*').eq('email', normalized.email).is('deleted_at', null).maybeSingle();
      if (data) return data;
    }
    if (normalized.phone) {
      const { data } = await sb.from('customers').select('*').eq('mobile_number', normalized.phone).is('deleted_at', null).maybeSingle();
      if (data) return data;
    }
  }
  if (resource === 'products' && normalized.code) {
    const { data } = await sb.from('qt_catalogue_products').select('*').eq('code', normalized.code).is('deleted_at', null).maybeSingle();
    if (data) return data;
  }
  if (resource === 'suppliers') {
    if (normalized.email) {
      const { data } = await sb.from('qt_suppliers').select('*').eq('email', normalized.email).is('deleted_at', null).maybeSingle();
      if (data) return data;
    }
    if (normalized.name) {
      const { data } = await sb.from('qt_suppliers').select('*').eq('name', normalized.name).is('deleted_at', null).maybeSingle();
      if (data) return data;
    }
  }
  return null;
}

function customerRow(row, actorId) {
  return {
    code: row.code || `SL-C-${row.source_record_id}`, full_name: row.company_name, company_name: row.company_name,
    contact_person: row.contact_person || null, mobile_number: row.phone || null, email: row.email || null,
    address: row.address || null, city: row.city || null, vat_number: row.vat_number || null, cr_number: row.cr_number || null,
    status: 'active', created_by: actorId, updated_by: actorId,
  };
}

function productRow(row, actorId) {
  return {
    code: row.code || `SL-P-${row.source_record_id}`, name: row.name, description: row.description || null,
    sku: row.sku || null, barcode: row.barcode || null, category: row.category || null,
    unit: row.unit || 'nos', standard_price: row.standard_price || 0,
    notes: `Read-only SmartLife source ${row.source_record_id}`, status: 'active', created_by: actorId, updated_by: actorId,
  };
}

function supplierRow(row, actorId) {
  return {
    name: row.name, contact_person: row.contact_person || null, phone: row.phone || null, email: row.email || null,
    address: row.address || null, vat_number: row.vat_number || null, cr_number: row.cr_number || null,
    status: 'active', created_by: actorId, updated_by: actorId,
  };
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const body = await req.json().catch(() => ({}));
  const resource = String(body.resource || '');
  const sourceRecordId = String(body.source_record_id || '').trim();
  if (!['customers', 'products', 'suppliers'].includes(resource) || !sourceRecordId) {
    return json({ error: 'A supported SmartLife master resource and source_record_id are required.' }, 400);
  }
  const sb = getDb();
  const { data: mapping, error: mappingError } = await sb.from('crm_record_mappings').select('*')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entity_type', resource)
    .eq('source_record_id', sourceRecordId).maybeSingle();
  if (mappingError) return json({ error: mappingError.message }, 500);
  if (!mapping?.metadata?.raw_payload) return json({ error: 'The synchronized SmartLife source record is unavailable.' }, 404);

  const normalized = normalizeSmartLifeMaster(resource, mapping.metadata.raw_payload);
  if (!normalized?.name && resource !== 'customers') return json({ error: 'The SmartLife source record has no usable name.' }, 422);
  if (resource === 'customers' && !normalized?.company_name) return json({ error: 'The SmartLife customer has no usable name.' }, 422);

  const table = resource === 'customers' ? 'customers' : resource === 'products' ? 'qt_catalogue_products' : 'qt_suppliers';
  let local = null;
  if (mapping.local_record_id) {
    const { data } = await sb.from(table).select('*').eq('id', mapping.local_record_id).is('deleted_at', null).maybeSingle();
    local = data || null;
  }
  if (!local) local = await existingLocal(sb, resource, normalized);
  if (!local) {
    const row = resource === 'customers' ? customerRow(normalized, session.sub)
      : resource === 'products' ? productRow(normalized, session.sub) : supplierRow(normalized, session.sub);
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) return json({ error: error.message }, 400);
    local = data;
    await audit(sb, table, local.id, 'insert_from_smartlife_snapshot', null, { source_record_id: sourceRecordId, read_only: true }, session.sub);
  }
  await sb.from('crm_record_mappings').update({
    local_record_id: String(local.id), sync_status: 'mapped', updated_at: new Date().toISOString(),
  }).eq('id', mapping.id);
  if (resource === 'customers') {
    const { mobile_number, ...rest } = local;
    local = { ...rest, phone: mobile_number };
  }
  return json({ row: local, source: 'SMARTLIFE', read_only: true, imported: true });
}
