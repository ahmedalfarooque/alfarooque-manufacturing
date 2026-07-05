'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ vehicles: [], drivers: [] });

  const sb = getDb();
  const [{ data: vehicles }, { data: drivers }] = await Promise.all([
    sb.from('cars').select('id, vehicle_number, name, vin_number, engine_number, insurance_number')
      .eq('is_active', true)
      .or(`vehicle_number.ilike.%${q}%,name.ilike.%${q}%,vin_number.ilike.%${q}%,engine_number.ilike.%${q}%,insurance_number.ilike.%${q}%`)
      .limit(6),
    sb.from('drivers').select('id, full_name, phone, email, license_number, iqama_number')
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,license_number.ilike.%${q}%,iqama_number.ilike.%${q}%`)
      .limit(6),
  ]);

  return json({ vehicles: vehicles || [], drivers: drivers || [] });
}
