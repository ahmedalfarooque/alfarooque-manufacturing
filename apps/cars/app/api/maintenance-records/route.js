'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const url = new URL(req.url);
  const q = url.searchParams;
  const search = (q.get('search') || '').trim();
  const carId = q.get('carId') || '';
  const driverId = q.get('driverId') || '';
  const shopId = q.get('shopId') || '';
  const category = q.get('category') || '';
  const paymentStatus = q.get('paymentStatus') || '';
  const dateFrom = q.get('dateFrom') || '';
  const dateTo = q.get('dateTo') || '';
  const costMin = q.get('costMin') || '';
  const costMax = q.get('costMax') || '';
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(q.get('pageSize') || '25', 10)));

  const sb = getDb();
  let query = sb.from('car_maintenance_records')
    .select('*, cars(vehicle_number, name), drivers(full_name), maintenance_shops(name), platform_users!car_maintenance_records_created_by_fkey(full_name, email)', { count: 'exact' });

  if (carId) query = query.eq('car_id', carId);
  if (driverId) query = query.eq('driver_id', driverId);
  if (shopId) query = query.eq('shop_id', shopId);
  if (category) query = query.eq('category', category);
  if (paymentStatus) query = query.eq('payment_status', paymentStatus);
  if (dateFrom) query = query.gte('maintenance_date', dateFrom);
  if (dateTo) query = query.lte('maintenance_date', dateTo);
  if (costMin) query = query.gte('amount', Number(costMin));
  if (costMax) query = query.lte('amount', Number(costMax));
  if (search) query = query.or(`invoice_number.ilike.%${search}%,maintenance_type.ilike.%${search}%,technician.ilike.%${search}%,work_performed.ilike.%${search}%`);

  query = query.order('maintenance_date', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) { console.error('[maintenance-records] list failed:', error.message); return json({ error: 'Could not load maintenance records.' }, 500); }
  return json({ records: data || [], total: count || 0, page, pageSize });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  if (!body.car_id) return json({ error: 'Vehicle is required.' }, 400);
  if (!body.category) return json({ error: 'Category is required.' }, 400);

  const sb = getDb();
  const row = {
    car_id: body.car_id,
    driver_id: body.driver_id || null,
    maintenance_date: body.maintenance_date || new Date().toISOString().slice(0, 10),
    category: body.category,
    maintenance_type: body.maintenance_type || null,
    shop_id: body.shop_id || null,
    odometer_km: body.odometer_km ? Number(body.odometer_km) : null,
    amount: body.amount ? Number(body.amount) : 0,
    currency: body.currency || 'SAR',
    invoice_number: body.invoice_number || null,
    payment_status: body.payment_status || 'Unpaid',
    technician: body.technician || null,
    warranty: body.warranty || null,
    work_performed: body.work_performed || null,
    parts_changed: body.parts_changed || null,
    labor_details: body.labor_details || null,
    notes: body.notes || null,
    created_by: session.sub || null,
  };
  const { data, error } = await sb.from('car_maintenance_records').insert(row).select().single();
  if (error) { console.error('[maintenance-records] create failed:', error.message); return json({ error: 'Could not add maintenance record.' }, 500); }
  return json({ record: data }, 201);
}
