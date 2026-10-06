'use strict';

/* The Vehicles list "Page view" catalogue — the single source of truth for
   which columns exist, their order, and which are on by default. The page
   attaches the cell renderers; Print, PDF and Excel read the same model.

   Required default view (in this exact order):
   #, Vehicle Number, Name, Type, Driver, Location, Insurance expiry date,
   Periodic inspection expiry date, Actions. Everything else is optional
   (`hidden: true`) and can be switched on from Page view. */

const VEHICLE_COLUMNS = [
  { key: 'idx', labelKey: 'vehicles.colNumber' },
  { key: 'vehicle_number', labelKey: 'vehicles.colVehicleNumber', sort: 'vehicle_number', excel: true },
  { key: 'name', labelKey: 'vehicles.colName', sort: 'name', excel: true },
  { key: 'type', labelKey: 'vehicles.colType', sort: 'type', excel: true },
  { key: 'driver', labelKey: 'vehicles.colDriver', sort: 'driver', excel: true },
  { key: 'location', labelKey: 'vehicles.colLocation', sort: 'location', excel: true },
  { key: 'insurance_expiry', labelKey: 'vehicles.colInsuranceExpiry', sort: 'insurance_expiry', excel: true },
  { key: 'periodic_inspection_expiry', labelKey: 'vehicles.colInspectionExpiry', sort: 'periodic_inspection_expiry', excel: true },
  { key: 'fuel_type', labelKey: 'vehicles.colFuel', sort: 'fuel_type', hidden: true, excel: true },
  { key: 'status', labelKey: 'vehicles.colStatus', sort: 'status', hidden: true, excel: true },
  { key: 'make', labelKey: 'fields.make', sort: 'make', hidden: true, excel: true },
  { key: 'model', labelKey: 'fields.model', sort: 'model', hidden: true, excel: true },
  { key: 'year', labelKey: 'fields.year', sort: 'year', hidden: true, excel: true },
  { key: 'current_km', labelKey: 'fields.currentKm', sort: 'current_km', hidden: true, excel: true },
  { key: 'registration_expiry', labelKey: 'fields.registrationExpiry', sort: 'registration_expiry', hidden: true, excel: true },
  { key: 'last_update', labelKey: 'vehicles.colLastUpdate', sort: 'last_update', hidden: true, excel: true },
  { key: 'actions', labelKey: 'vehicles.colActions', required: true, noPdf: true },
];

/* Excel catalogue (server side, English headers): key → header/width. */
const VEHICLE_EXCEL_COLUMNS = {
  vehicle_number: { header: 'Vehicle Number', width: 16 },
  name: { header: 'Vehicle Name', width: 20 },
  type: { header: 'Type', width: 12 },
  driver: { header: 'Driver', width: 16 },
  location: { header: 'Location', width: 18 },
  insurance_expiry: { header: 'Insurance Expiry Date', width: 20 },
  periodic_inspection_expiry: { header: 'Periodic Inspection Expiry Date', width: 28 },
  fuel_type: { header: 'Fuel Type', width: 12 },
  status: { header: 'Status', width: 12 },
  make: { header: 'Make', width: 14 },
  model: { header: 'Model', width: 14 },
  year: { header: 'Year', width: 8 },
  current_km: { header: 'Current KM', width: 14 },
  registration_expiry: { header: 'Registration Expiry', width: 20 },
  last_update: { header: 'Last Update', width: 20 },
};

/* Resolve a `cols` query value (comma-separated page-view keys) to the Excel
   column list, in the requested order. Non-Excel keys (#, Actions) and
   unknown keys are ignored; an empty/absent selection falls back to the
   default page view. */
function excelColumnsFor(colsParam) {
  const requested = String(colsParam || '').split(',').map(s => s.trim()).filter(Boolean);
  const keys = (requested.length ? requested : VEHICLE_COLUMNS.filter(c => !c.hidden).map(c => c.key)).filter(k => VEHICLE_EXCEL_COLUMNS[k]);
  const uniq = [...new Set(keys)];
  const finalKeys = uniq.length ? uniq : Object.keys(VEHICLE_EXCEL_COLUMNS);
  return finalKeys.map(k => ({ key: k, ...VEHICLE_EXCEL_COLUMNS[k] }));
}

function defaultVehicleColumnKeys() {
  return VEHICLE_COLUMNS.filter(c => !c.hidden || c.required).map(c => c.key);
}

module.exports = { VEHICLE_COLUMNS, VEHICLE_EXCEL_COLUMNS, excelColumnsFor, defaultVehicleColumnKeys };
