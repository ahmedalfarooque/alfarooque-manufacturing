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

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const status = url.searchParams.get('status') || 'All';

  const sb = getDb();
  let query = sb.from('drivers').select('*, cars!drivers_assigned_car_id_fkey(vehicle_number)').order('full_name', { ascending: true });
  if (search) query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,license_number.ilike.%${search}%,iqama_number.ilike.%${search}%,employee_id.ilike.%${search}%`);
  if (status !== 'All') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { console.error('[drivers] list failed:', error.message); return json({ error: 'Could not load drivers.' }, 500); }
  return json({ drivers: data });
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.full_name || '').trim();
  if (!fullName) return json({ error: 'Full name is required.' }, 400);

  const row = {};
  for (const key of EDITABLE) if (key in body) row[key] = body[key] === '' ? null : body[key];
  row.full_name = fullName;

  const sb = getDb();
  const { data, error } = await sb.from('drivers').insert(row).select().single();
  if (error) { console.error('[drivers] create failed:', error.message); return json({ error: 'Could not add driver.' }, 500); }

  await sb.from('driver_activity_log').insert({ driver_id: data.id, activity: 'Driver profile created' });
  return json({ driver: data }, 201);
}
