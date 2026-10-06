'use strict';

/* Pure "Page view" column logic shared by components/ColumnPicker.js and the
   node tests. A column: { key, label, render?, pdf?, sort?, required?,
   hidden?, noPdf? }
     - required: cannot be hidden (e.g. Actions) and is always re-added
     - hidden:   off by default (optional extra column)
     - noPdf:    never exported (interactive columns such as Actions)
   Visible keys are always kept in the page's declared column order. */

const STORAGE_PREFIX = 'af-cars-cols:';

function allKeys(columns) {
  return columns.map(c => c.key);
}

function defaultKeys(columns) {
  return columns.filter(c => !c.hidden || c.required).map(c => c.key);
}

/* Reconcile a saved preference with the current column list: unknown keys
   are dropped, required columns are forced on, order follows `columns`.
   Returns null when `saved` is not a usable array (caller uses defaults). */
function mergeSaved(columns, saved) {
  if (!Array.isArray(saved)) return null;
  const want = new Set(saved.filter(k => typeof k === 'string'));
  return columns.filter(c => c.required || want.has(c.key)).map(c => c.key);
}

/* Toggle one key; required columns are immutable. */
function toggleKey(columns, visibleKeys, key) {
  const col = columns.find(c => c.key === key);
  if (!col || col.required) return visibleKeys;
  const set = new Set(visibleKeys);
  if (set.has(key)) set.delete(key); else set.add(key);
  return columns.filter(c => set.has(c.key)).map(c => c.key);
}

function visibleColumns(columns, visibleKeys) {
  const set = new Set(visibleKeys);
  return columns.filter(c => set.has(c.key));
}

/* Export helpers: only visible, exportable columns, in page order. */
function pdfColumns(visibleCols) {
  return visibleCols.filter(c => !c.noPdf).map(c => ({ key: c.key, header: c.label }));
}

function pdfRows(visibleCols, rows) {
  const cols = visibleCols.filter(c => !c.noPdf);
  return (rows || []).map((row, i) => Object.fromEntries(cols.map(c => [c.key, c.pdf ? c.pdf(row, i) : (row[c.key] ?? '')])));
}

/* Storage helpers. `storage` is anything with getItem/setItem (localStorage
   in the browser, a Map-backed stub in tests). Each page has its own key, so
   preferences never leak between pages; corrupt/missing data → defaults. */
function loadPrefs(storage, pageKey, columns) {
  let saved = null;
  try { const raw = storage && storage.getItem(STORAGE_PREFIX + pageKey); saved = raw ? JSON.parse(raw) : null; } catch (_) { saved = null; }
  return mergeSaved(columns, saved) || defaultKeys(columns);
}

function savePrefs(storage, pageKey, keys) {
  try { storage && storage.setItem(STORAGE_PREFIX + pageKey, JSON.stringify(keys)); } catch (_) {}
}

module.exports = { STORAGE_PREFIX, allKeys, defaultKeys, mergeSaved, toggleKey, visibleColumns, pdfColumns, pdfRows, loadPrefs, savePrefs };
