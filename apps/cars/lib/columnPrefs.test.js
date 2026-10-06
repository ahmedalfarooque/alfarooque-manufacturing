'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultKeys, mergeSaved, toggleKey, visibleColumns, pdfColumns, pdfRows, loadPrefs, savePrefs } = require('./columnPrefs');
const { VEHICLE_COLUMNS, defaultVehicleColumnKeys, excelColumnsFor } = require('./vehicleColumns');

const cols = [
  { key: 'idx', label: '#', pdf: (r, i) => i + 1 },
  { key: 'name', label: 'Name' },
  { key: 'location', label: 'Location' },
  { key: 'fuel', label: 'Fuel', hidden: true },
  { key: 'actions', label: 'Actions', required: true, noPdf: true },
];

test('vehicles default view is exactly the required nine columns, in order', () => {
  assert.deepEqual(defaultVehicleColumnKeys(), ['idx', 'vehicle_number', 'name', 'type', 'driver', 'location', 'insurance_expiry', 'periodic_inspection_expiry', 'actions']);
  const byKey = Object.fromEntries(VEHICLE_COLUMNS.map(c => [c.key, c]));
  assert.equal(byKey.actions.required, true);
  assert.equal(byKey.actions.noPdf, true);
  assert.equal(byKey.insurance_expiry.labelKey, 'vehicles.colInsuranceExpiry');
  assert.equal(byKey.periodic_inspection_expiry.labelKey, 'vehicles.colInspectionExpiry');
  for (const k of ['fuel_type', 'status', 'make', 'model', 'year', 'current_km', 'registration_expiry', 'last_update']) assert.equal(byKey[k].hidden, true, k + ' is optional');
});

test('defaults: hidden columns off, required always on', () => {
  assert.deepEqual(defaultKeys(cols), ['idx', 'name', 'location', 'actions']);
});

test('saved preference: unknown keys dropped, required forced on, page order kept', () => {
  assert.deepEqual(mergeSaved(cols, ['fuel', 'name', 'ghost']), ['name', 'fuel', 'actions']);
  assert.equal(mergeSaved(cols, 'nope'), null);       // corrupt → caller uses defaults
  assert.deepEqual(mergeSaved(cols, []), ['actions']); // never allow hiding everything
});

test('toggle hides/shows a column and never touches a required one', () => {
  let keys = defaultKeys(cols);
  keys = toggleKey(cols, keys, 'location');
  assert.deepEqual(keys, ['idx', 'name', 'actions']);
  keys = toggleKey(cols, keys, 'fuel');
  assert.deepEqual(keys, ['idx', 'name', 'fuel', 'actions']);
  assert.deepEqual(toggleKey(cols, keys, 'actions'), keys);
  assert.deepEqual(toggleKey(cols, keys, 'missing'), keys);
});

test('table, print and pdf read the same visible set; actions never exported', () => {
  const keys = toggleKey(cols, defaultKeys(cols), 'location');   // hide Location
  const vis = visibleColumns(cols, keys);
  assert.deepEqual(vis.map(c => c.key), ['idx', 'name', 'actions']);
  assert.deepEqual(pdfColumns(vis), [{ key: 'idx', header: '#' }, { key: 'name', header: 'Name' }]);
  assert.deepEqual(pdfRows(vis, [{ name: 'A', location: 'X' }, { name: 'B' }]), [{ idx: 1, name: 'A' }, { idx: 2, name: 'B' }]);
  // re-enable → back in every output
  const again = visibleColumns(cols, toggleKey(cols, keys, 'location'));
  assert.deepEqual(pdfColumns(again).map(c => c.key), ['idx', 'name', 'location']);
});

test('reset returns to defaults after any change', () => {
  const changed = toggleKey(cols, toggleKey(cols, defaultKeys(cols), 'name'), 'fuel');
  assert.notDeepEqual(changed, defaultKeys(cols));
  assert.deepEqual(defaultKeys(cols), ['idx', 'name', 'location', 'actions']);
});

test('excel export follows the page view: requested order, unknown/non-excel keys ignored, safe fallback', () => {
  assert.deepEqual(excelColumnsFor('idx,name,fuel_type,actions,ghost').map(c => c.key), ['name', 'fuel_type']);
  assert.deepEqual(excelColumnsFor('').map(c => c.key), ['vehicle_number', 'name', 'type', 'driver', 'location', 'insurance_expiry', 'periodic_inspection_expiry']);
  assert.ok(excelColumnsFor('idx,actions').length > 0, 'never an empty sheet');
  assert.deepEqual(excelColumnsFor('name,name').map(c => c.key), ['name']);
});

function memStorage() { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), keys: () => [...m.keys()] }; }

test('persistence: a hidden column survives reload; page keys are isolated; corrupt data falls back to defaults', () => {
  const st = memStorage();
  const keys = toggleKey(cols, defaultKeys(cols), 'location');
  savePrefs(st, 'vehicles', keys);
  assert.deepEqual(loadPrefs(st, 'vehicles', cols), ['idx', 'name', 'actions']);      // "reload"
  assert.deepEqual(loadPrefs(st, 'drivers', cols), defaultKeys(cols));               // other page untouched
  assert.deepEqual(st.keys(), ['af-cars-cols:vehicles']);
  st.setItem('af-cars-cols:vehicles', '{not json');
  assert.deepEqual(loadPrefs(st, 'vehicles', cols), defaultKeys(cols));
  st.setItem('af-cars-cols:vehicles', JSON.stringify(['ghost', 42, null]));
  assert.deepEqual(loadPrefs(st, 'vehicles', cols), ['actions']);                    // unknown ids ignored, required kept
  assert.deepEqual(loadPrefs(null, 'vehicles', cols), defaultKeys(cols));            // no storage at all
});

test('admin-only column appearing after permissions resolve is shown, with or without a saved preference', () => {
  const viewerCols = cols.filter(c => c.key !== 'actions');
  const st = memStorage();
  // saved while the Actions column did not exist yet (viewer render, pre-session)
  savePrefs(st, 'shops', toggleKey(viewerCols, defaultKeys(viewerCols), 'location'));
  assert.deepEqual(loadPrefs(st, 'shops', viewerCols), ['idx', 'name']);
  assert.deepEqual(loadPrefs(st, 'shops', cols), ['idx', 'name', 'actions']);        // admin column re-added after it appears
  assert.deepEqual(loadPrefs(memStorage(), 'shops', cols), ['idx', 'name', 'location', 'actions']);
});
