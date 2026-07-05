'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = [
  'car_id', 'driver_id', 'maintenance_date', 'category', 'maintenance_type', 'shop_id',
  'odometer_km', 'amount', 'currency', 'invoice_number', 'payment_status', 'technician',
  'warranty', 'work_performed', 'parts_changed', 'labor_details', 'notes',
];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: record, error } = await sb.from('car_maintenance_records')
    .select('*, cars(vehicle_number, name, current_km), drivers(full_name, phone, license_number), maintenance_shops(*), platform_users!car_maintenance_records_created_by_fkey(full_name, email)')
    .eq('id', params.id).maybeSingle();
  if (error) { console.error('[maintenance-records] get failed:', error.message); return json({ error: 'Could not load maintenance record.' }, 500); }
  if (!record) return json({ error: 'Maintenance record not found.' }, 404);

  const { data: attachments } = await sb.from('car_maintenance_attachments').select('*').eq('record_id', params.id).order('created_at', { ascending: true });
  return json({ record, attachments: attachments || [] });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  if ('odometer_km' in patch) patch.odometer_km = patch.odometer_km ? Number(patch.odometer_km) : null;
  if ('amount' in patch) patch.amount = Number(patch.amount || 0);

  const sb = getDb();
  const { data, error } = await sb.from('car_maintenance_records').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[maintenance-records] update failed:', error.message); return json({ error: 'Could not update maintenance record.' }, 500); }
  if (!data) return json({ error: 'Maintenance record not found.' }, 404);
  return json({ record: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: attachments } = await sb.from('car_maintenance_attachments').select('storage_path').eq('record_id', params.id);
  if (attachments?.length) await sb.storage.from('maintenance-documents').remove(attachments.map(a => a.storage_path)).catch(() => {});

  const { error } = await sb.from('car_maintenance_records').delete().eq('id', params.id);
  if (error) { console.error('[maintenance-records] delete failed:', error.message); return json({ error: 'Could not delete maintenance record.' }, 500); }
  return json({ ok: true });
}
