'use strict';

/* Local warehouse master (inv_warehouses) with a read-only fallback onto
   SmartLife's real warehouses (2 real records) when the local table is
   empty — same pattern as Suppliers' qt_suppliers fallback. Unlike
   Products/Materials, there's no business-domain split here: a warehouse
   is unambiguously the same real entity regardless of which app shows
   it. SmartLife's real schema is only {id, name, latitude, longitude}
   (both always null) — no address/manager/capacity/status field exists,
   so none is fabricated here. */

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('inv_warehouses').select('*').order('name', { ascending: true });
  if (error) return json({ error: 'Could not load warehouses.' }, 500);
  if (data && data.length) return json({ warehouses: data.map(w => ({ ...w, read_only: false })) });

  /* Local-first: crm_record_mappings already holds SmartLife's warehouses
     (same canonical sync job as Products/Purchases/Sales Invoices/Account
     Balances) — reading it instead of a live SmartLife call means a normal
     page load never hits SmartERP; only the Sync button does. */
  try {
    const { data: mappings, error: mapError } = await sb.from('crm_record_mappings')
      .select('metadata').eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife').eq('entity_type', 'warehouses');
    if (mapError) throw mapError;
    const warehouses = (mappings || []).map(m => m.metadata?.raw_payload).filter(Boolean)
      .map(r => ({ id: r.id, name: r.name, code: null, address: null, city: null, is_active: true, read_only: true }))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
    return json({ warehouses });
  } catch (_) {
    return json({ warehouses: [] });
  }
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) return json({ error: 'Warehouse name is required.' }, 400);

  const { data, error } = await sb.from('inv_warehouses').insert({
    name,
    code: body.code || null,
    address: body.address || null,
    city: body.city || null,
    manager_id: body.manager_id || null,
    is_active: true,
  }).select().single();
  if (error) return json({ error: 'Could not add warehouse.' }, 500);
  return json({ warehouse: data }, 201);
}
