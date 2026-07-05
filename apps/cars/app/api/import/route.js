'use strict';

/* POST /cars/api/import — multipart/form-data, field "file" = .xlsx
   Parses the uploaded workbook, auto-maps columns (supports both plain
   English headers AND the real AL FAROOQUE fleet sheet's Arabic
   headers — رقم اللوحة/الماركة/الطراز/etc, since that's the actual
   file this feature exists to import), and inserts new vehicles.
   Existing vehicle_number values are skipped, never overwritten, so
   re-uploading the same sheet is always safe (no duplicates, no silent
   data loss on a row that was hand-edited in the dashboard since). */

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

/* header text (lowercased, trimmed) → cars column */
const HEADER_MAP = {
  '#': null,
  'رقم اللوحة': 'vehicle_number', 'plate': 'vehicle_number', 'plate number': 'vehicle_number',
  'vehicle number': 'vehicle_number', 'vehicle_number': 'vehicle_number',
  'الماركة': 'make', 'make': 'make', 'brand': 'make',
  'الطراز': 'model', 'model': 'model',
  'السنة': 'year', 'year': 'year',
  'اللون': 'color', 'color': 'color', 'colour': 'color',
  'الرقم التسلسلي': 'serial_number', 'serial': 'serial_number', 'vin': 'serial_number', 'serial number': 'serial_number',
  'الحالة': 'condition_status', 'status': 'status', 'condition': 'condition_status',
  'نوع الزيت': 'oil_type', 'oil type': 'oil_type',
  'اللزوجة': 'oil_viscosity', 'viscosity': 'oil_viscosity',
  'العلب': 'oil_capacity_l', 'oil capacity': 'oil_capacity_l', 'capacity': 'oil_capacity_l',
  'الكم الحالي': 'current_km', 'current km': 'current_km', 'odometer': 'current_km', 'km': 'current_km',
  'السائق': 'driver', 'driver': 'driver',
  'ملاحظات': 'notes', 'notes': 'notes', 'remarks': 'notes',
  'type': 'type', 'vehicle type': 'type', 'الفئة': 'type',
  'fuel type': 'fuel_type', 'fuel': 'fuel_type', 'نوع الوقود': 'fuel_type',
  'name': 'name', 'vehicle name': 'name', 'الاسم': 'name',
  'location': 'location', 'الموقع': 'location',
};

function normalizeHeader(h) { return String(h || '').trim().toLowerCase().replace(/\s+/g, ' '); }

/* Real-world fleet workbooks (including the actual AL FAROOQUE sheet)
   often have MULTIPLE unrelated tables that each happen to include a
   "Plate Number" column — a maintenance log, a cost-analysis summary,
   a periodic-service tracker, etc — all sharing that one column with
   the actual vehicle master list. Matching on "≥3 header tokens
   anywhere" is not enough to tell those apart (a cost-analysis header
   row matched here once, mixing $ figures into vehicle records). A row
   only counts as the vehicle table's header if it has vehicle_number
   AND at least one column that only a vehicle master list would have
   (make/model/year/color) — a maintenance or cost sheet never has
   those. */
const VEHICLE_TABLE_MARKERS = ['make', 'model', 'year', 'color'];

function findHeaderRow(rows) {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i];
    const mapped = row.map(cell => HEADER_MAP[normalizeHeader(cell)]);
    const hasVehicleNumber = mapped.includes('vehicle_number');
    const hasVehicleMarker = mapped.some(col => VEHICLE_TABLE_MARKERS.includes(col));
    const totalMatches = mapped.filter(col => col !== undefined).length;
    if (hasVehicleNumber && hasVehicleMarker && totalMatches >= 3) return i;
  }
  return -1;
}

const ARABIC_CONDITION_VALID = ['صالحة', 'صالحه', 'valid', 'roadworthy'];

/* ── Periodic maintenance sheet ("الصيانات الدورية") — per-item
   service intervals, drives the Maintenance Due widget/page with real
   numbers instead of zeros. Purely additive: if this sheet isn't
   present, importing vehicles alone still works fine. ── */
const MAINTENANCE_SHEET_NAME_RE = /الصيانات الدورية|periodic maintenance/i;
const MAINTENANCE_HEADER_MAP = {
  'رقم اللوحة': 'vehicle_number', 'plate': 'vehicle_number', 'plate number': 'vehicle_number',
  'نوع الصيانة': 'maintenance_type', 'maintenance type': 'maintenance_type',
  'آخر صيانة (كم)': 'last_service_km', 'last service km': 'last_service_km',
  'الفاصل (كم)': 'interval_km', 'interval km': 'interval_km',
  'ملاحظات': 'notes', 'notes': 'notes',
};

async function importMaintenanceSheet(workbook, sb, plateToCarId) {
  const ws = workbook.worksheets.find(w => MAINTENANCE_SHEET_NAME_RE.test(w.name || ''));
  if (!ws) return { inserted: 0, skipped: 0, found: false };

  const rows = [];
  ws.eachRow(row => { rows.push(row.values.slice(1).map(v => (v && v.result !== undefined ? v.result : v))); });
  let headerIdx = -1, columns = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const mapped = rows[i].map(cell => MAINTENANCE_HEADER_MAP[normalizeHeader(cell)]);
    if (mapped.includes('vehicle_number') && mapped.includes('maintenance_type')) { headerIdx = i; columns = mapped; break; }
  }
  if (headerIdx === -1) return { inserted: 0, skipped: 0, found: true, error: 'header not found' };

  const { data: existingItems } = await sb.from('car_maintenance').select('car_id, maintenance_type');
  const existingKeys = new Set((existingItems || []).map(r => r.car_id + '|' + r.maintenance_type));

  const toInsert = [];
  let skipped = 0;
  for (const row of rows.slice(headerIdx + 1)) {
    const rec = {};
    columns.forEach((col, i) => { if (col) rec[col] = row[i]; });
    const carId = plateToCarId.get(String(rec.vehicle_number || '').trim());
    const type = rec.maintenance_type ? String(rec.maintenance_type).trim() : '';
    if (!carId || !type) { skipped++; continue; }
    const key = carId + '|' + type;
    if (existingKeys.has(key)) { skipped++; continue; }
    toInsert.push({
      car_id: carId,
      maintenance_type: type,
      last_service_km: Number(rec.last_service_km) || 0,
      interval_km: Number(rec.interval_km) || 10000,
      notes: rec.notes && String(rec.notes).trim() !== '—' ? String(rec.notes).trim() : null,
    });
    existingKeys.add(key);
  }
  if (toInsert.length === 0) return { inserted: 0, skipped, found: true };
  const { data, error } = await sb.from('car_maintenance').insert(toInsert).select('id');
  if (error) { console.error('[import] maintenance insert failed:', error.message); return { inserted: 0, skipped, found: true, error: error.message }; }
  return { inserted: data.length, skipped, found: true };
}

/* ── Service history log sheet ("سجل الصيانة") — real past services
   with cost, so the Maintenance Cost widget stops showing SAR 0. ── */
const LOG_SHEET_NAME_RE = /سجل الصيانة|maintenance log|service log/i;
const LOG_HEADER_MAP = {
  'التاريخ': 'service_date', 'date': 'service_date',
  'رقم اللوحة': 'vehicle_number', 'plate': 'vehicle_number',
  'الوصف': 'description', 'description': 'description',
  'الورشة/المورد': 'workshop', 'workshop': 'workshop', 'supplier': 'workshop',
  'التكلفة (ر.س)': 'cost', 'cost': 'cost',
  'الكيلومتر': 'km_at_service', 'km': 'km_at_service', 'odometer': 'km_at_service',
  'الحالة': 'status', 'status': 'status',
  'ملاحظات': 'notes', 'notes': 'notes',
};

function excelDateToIso(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return null;
}

async function importMaintenanceLogSheet(workbook, sb, plateToCarId) {
  const ws = workbook.worksheets.find(w => LOG_SHEET_NAME_RE.test(w.name || ''));
  if (!ws) return { inserted: 0, skipped: 0, found: false };

  const rows = [];
  ws.eachRow(row => { rows.push(row.values.slice(1).map(v => (v && v.result !== undefined ? v.result : v))); });
  let headerIdx = -1, columns = [];
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const mapped = rows[i].map(cell => LOG_HEADER_MAP[normalizeHeader(cell)]);
    if (mapped.includes('vehicle_number') && mapped.includes('service_date')) { headerIdx = i; columns = mapped; break; }
  }
  if (headerIdx === -1) return { inserted: 0, skipped: 0, found: true, error: 'header not found' };

  const { data: existingLogs } = await sb.from('car_maintenance_log').select('car_id, service_date, description');
  const existingKeys = new Set((existingLogs || []).map(r => [r.car_id, r.service_date, r.description].join('|')));

  const toInsert = [];
  let skipped = 0;
  for (const row of rows.slice(headerIdx + 1)) {
    const rec = {};
    columns.forEach((col, i) => { if (col) rec[col] = row[i]; });
    const carId = plateToCarId.get(String(rec.vehicle_number || '').trim());
    const serviceDate = excelDateToIso(rec.service_date);
    if (!carId || !serviceDate) { skipped++; continue; }
    const description = rec.description ? String(rec.description).trim() : null;
    const key = [carId, serviceDate, description].join('|');
    if (existingKeys.has(key)) { skipped++; continue; }
    toInsert.push({
      car_id: carId,
      service_date: serviceDate,
      description,
      workshop: rec.workshop && String(rec.workshop).trim() !== '—' ? String(rec.workshop).trim() : null,
      cost: Number(rec.cost) || 0,
      km_at_service: rec.km_at_service ? Number(rec.km_at_service) : null,
      status: rec.status ? String(rec.status).trim() : 'Completed',
      notes: rec.notes && String(rec.notes).trim() !== '—' ? String(rec.notes).trim() : null,
    });
    existingKeys.add(key);
  }
  if (toInsert.length === 0) return { inserted: 0, skipped, found: true };
  const { data, error } = await sb.from('car_maintenance_log').insert(toInsert).select('id');
  if (error) { console.error('[import] log insert failed:', error.message); return { inserted: 0, skipped, found: true, error: error.message }; }
  return { inserted: data.length, skipped, found: true };
}

export async function POST(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);

  const buf = Buffer.from(await file.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buf);
  } catch (e) {
    return json({ error: 'Could not read this file — please upload a valid .xlsx workbook.' }, 400);
  }

  /* Prefer a sheet whose name is obviously the fleet/vehicle master
     list (the real AL FAROOQUE workbook calls it "الأسطول") — checking
     that sheet alone avoids ever touching the cover/KPI/maintenance/
     cost-analysis sheets that share some column names but aren't a
     vehicle table. Only fall back to scanning every sheet if no
     sheet name matches (a generic/unknown workbook). */
  const FLEET_SHEET_NAME_RE = /الأسطول|fleet|vehicles?/i;
  const namedSheet = workbook.worksheets.find(ws => FLEET_SHEET_NAME_RE.test(ws.name || ''));
  const candidateSheets = namedSheet ? [namedSheet] : workbook.worksheets;

  let headerRowIdx = -1, headers = [], dataRows = [];
  for (const ws of candidateSheets) {
    const rows = [];
    ws.eachRow(row => { rows.push(row.values.slice(1).map(v => (v && v.result !== undefined ? v.result : v))); });
    const idx = findHeaderRow(rows);
    if (idx >= 0) {
      headerRowIdx = idx; headers = rows[idx]; dataRows = rows.slice(idx + 1);
      break;
    }
  }
  if (headerRowIdx === -1) return json({ error: 'Could not find a recognizable vehicle table in this file (need columns like Plate Number, Make, Model).' }, 400);

  const columns = headers.map(h => HEADER_MAP[normalizeHeader(h)]);
  if (!columns.includes('vehicle_number')) return json({ error: 'This sheet has no Plate/Vehicle Number column — cannot import.' }, 400);

  const sb = getDb();
  const { data: existingCars } = await sb.from('cars').select('vehicle_number');
  const existing = new Set((existingCars || []).map(c => String(c.vehicle_number).trim()));

  const toInsert = [];
  let skippedEmpty = 0, skippedDuplicate = 0;
  for (const row of dataRows) {
    const rec = {};
    columns.forEach((col, i) => { if (col) rec[col] = row[i]; });
    const vehicleNumber = String(rec.vehicle_number || '').trim();
    if (!vehicleNumber || vehicleNumber === '—' || vehicleNumber === '-') { skippedEmpty++; continue; }
    if (existing.has(vehicleNumber)) { skippedDuplicate++; continue; }

    const make = rec.make ? String(rec.make).trim() : null;
    const model = rec.model ? String(rec.model).trim() : null;
    const driver = rec.driver && String(rec.driver).trim() !== '—' ? String(rec.driver).trim() : null;
    const conditionRaw = rec.condition_status ? String(rec.condition_status).trim() : null;

    toInsert.push({
      vehicle_number: vehicleNumber,
      name: rec.name ? String(rec.name).trim() : [make, model].filter(Boolean).join(' ') || vehicleNumber,
      make, model,
      year: rec.year ? parseInt(rec.year, 10) || null : null,
      color: rec.color ? String(rec.color).trim() : null,
      serial_number: rec.serial_number ? String(rec.serial_number).trim() : null,
      type: rec.type ? String(rec.type).trim() : 'Vehicle',
      fuel_type: rec.fuel_type ? String(rec.fuel_type).trim() : 'Diesel',
      driver,
      status: rec.status && ['Running', 'Idle', 'Stopped', 'Offline'].includes(rec.status) ? rec.status : 'Idle',
      condition_status: conditionRaw ? (ARABIC_CONDITION_VALID.includes(conditionRaw.toLowerCase()) || ARABIC_CONDITION_VALID.includes(conditionRaw) ? 'Valid' : conditionRaw) : 'Valid',
      oil_type: rec.oil_type && String(rec.oil_type).trim() !== '—' ? String(rec.oil_type).trim() : null,
      oil_viscosity: rec.oil_viscosity && String(rec.oil_viscosity).trim() !== '—' ? String(rec.oil_viscosity).trim() : null,
      oil_capacity_l: rec.oil_capacity_l ? Number(rec.oil_capacity_l) || null : null,
      current_km: rec.current_km ? Number(rec.current_km) || 0 : 0,
      location: rec.location ? String(rec.location).trim() : null,
      notes: rec.notes && String(rec.notes).trim() !== '—' ? String(rec.notes).trim() : null,
    });
    existing.add(vehicleNumber); // guard against duplicate plate numbers within the same sheet
  }

  let insertedCount = 0;
  if (toInsert.length > 0) {
    const { data, error } = await sb.from('cars').insert(toInsert).select('id');
    if (error) { console.error('[import] insert failed:', error.message); return json({ error: 'Import failed while saving to the database: ' + error.message }, 500); }
    insertedCount = data.length;
  }

  /* Plate → car_id lookup, built AFTER the vehicle insert above so
     newly-imported vehicles are included — the maintenance/log sheets
     reference the same plates and need their car_id to attach to. */
  const { data: allCars } = await sb.from('cars').select('id, vehicle_number');
  const plateToCarId = new Map((allCars || []).map(c => [String(c.vehicle_number).trim(), c.id]));

  const maintenanceResult = await importMaintenanceSheet(workbook, sb, plateToCarId);
  const logResult = await importMaintenanceLogSheet(workbook, sb, plateToCarId);

  if (insertedCount === 0 && !maintenanceResult.found && !logResult.found) {
    return json({ ok: true, inserted: 0, skippedDuplicate, skippedEmpty, message: 'Nothing new to import — every row was already in the fleet or had no plate number.' });
  }

  return json({
    ok: true,
    inserted: insertedCount, skippedDuplicate, skippedEmpty,
    maintenance: { inserted: maintenanceResult.inserted, skipped: maintenanceResult.skipped, sheetFound: maintenanceResult.found },
    maintenanceLog: { inserted: logResult.inserted, skipped: logResult.skipped, sheetFound: logResult.found },
  });
}
