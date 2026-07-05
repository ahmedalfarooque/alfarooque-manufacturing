'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const EDITABLE = [
  'full_name', 'full_name_ar', 'employee_id', 'phone', 'whatsapp', 'email', 'nationality',
  'date_of_birth', 'blood_group', 'address', 'emergency_contact', 'emergency_phone',
  'department', 'designation', 'joining_date', 'status', 'license_number', 'license_type',
  'license_issue_date', 'license_expiry_date', 'iqama_number', 'iqama_expiry_date',
  'passport_number', 'passport_expiry_date', 'medical_expiry_date', 'notes',
  'assigned_car_id', 'experience_years', 'driving_category',
];

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: driver, error } = await sb.from('drivers').select('*, cars!drivers_assigned_car_id_fkey(id, vehicle_number, status)').eq('id', params.id).maybeSingle();
  if (error) { console.error('[drivers] get failed:', error.message); return json({ error: 'Could not load driver.' }, 500); }
  if (!driver) return json({ error: 'Driver not found.' }, 404);

  const { data: activity } = await sb.from('driver_activity_log').select('*').eq('driver_id', params.id).order('created_at', { ascending: false }).limit(20);
  return json({ driver, activity: activity || [] });
}

export async function PATCH(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const patch = {};
  for (const key of EDITABLE) if (key in body) patch[key] = body[key] === '' ? null : body[key];
  if (Object.keys(patch).length === 0) return json({ error: 'Nothing to update.' }, 400);
  if ('full_name' in patch && !String(patch.full_name || '').trim()) return json({ error: 'Full name is required.' }, 400);

  const sb = getDb();
  const { data, error } = await sb.from('drivers').update(patch).eq('id', params.id).select().maybeSingle();
  if (error) { console.error('[drivers] update failed:', error.message); return json({ error: 'Could not update driver.' }, 500); }
  if (!data) return json({ error: 'Driver not found.' }, 404);

  if ('status' in patch) await sb.from('driver_activity_log').insert({ driver_id: params.id, activity: `Status changed to ${patch.status}` });
  else await sb.from('driver_activity_log').insert({ driver_id: params.id, activity: 'Profile updated' });
  return json({ driver: data });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;
  const sb = getDb();
  const { error } = await sb.from('drivers').delete().eq('id', params.id);
  if (error) { console.error('[drivers] delete failed:', error.message); return json({ error: 'Could not delete driver.' }, 500); }
  return json({ ok: true });
}
