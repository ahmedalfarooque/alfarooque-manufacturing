'use strict';

/* Structured material dimensions: height/width/length/thickness, each an
   optional (value, unit) pair — unit is one of mm/cm/meter. Shared by the
   Materials form, list/table display, cost-line pickers, and import/export
   so every surface formats/parses dimensions the same way. A 0 value is
   treated as "not set" (spec: never show "0 mm"). */

const DIM_UNITS = ['mm', 'cm', 'meter'];
const DIM_KEYS = ['height', 'width', 'length', 'thickness'];

function numOrNull(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function fmtNum(v) {
  return String(Math.round(v * 1000) / 1000);
}

/* [{ key, value, unit }] for whichever dims are actually set on the row. */
function presentDims(row) {
  const out = [];
  for (const k of DIM_KEYS) {
    const v = numOrNull(row[k + '_value']);
    const u = row[k + '_unit'];
    if (v != null && u) out.push({ key: k, value: v, unit: u });
  }
  return out;
}

/* Single display string for a table cell / spec line, e.g.
   "210 × 90 × 4.5 cm" (multiple dims, same unit), "Height: 210 cm"
   (one dim), or "" when nothing is set. */
function formatMaterialDims(row, t) {
  const dims = presentDims(row);
  if (!dims.length) return '';
  if (dims.length === 1) {
    const d = dims[0];
    return `${t('dim.' + d.key)}: ${fmtNum(d.value)} ${t('dimunit.' + d.unit)}`;
  }
  const sameUnit = dims.every(d => d.unit === dims[0].unit);
  if (sameUnit) return dims.map(d => fmtNum(d.value)).join(' × ') + ' ' + t('dimunit.' + dims[0].unit);
  return dims.map(d => `${t('dim.' + d.key)}: ${fmtNum(d.value)} ${t('dimunit.' + d.unit)}`).join(' · ');
}

/* Parse an import cell into { value, unit }. If a separate unit cell is
   given, the value cell is treated as a plain number. Otherwise falls
   back to parsing legacy combined text like "18mm" / "1.8 cm" / "2m". */
function parseDimField(valueCell, unitCell) {
  const raw = String(valueCell == null ? '' : valueCell).trim();
  if (!raw) return { value: null, unit: null };
  const unitIn = String(unitCell == null ? '' : unitCell).trim().toLowerCase();
  if (unitIn) {
    const u = normalizeUnit(unitIn);
    const n = parseFloat(raw.replace(/[^\d.\-]/g, ''));
    return { value: Number.isFinite(n) && n !== 0 ? n : null, unit: u };
  }
  const m = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*(mm|cm|m|meter|metre)?/i);
  if (!m) return { value: null, unit: null };
  const n = parseFloat(m[1]);
  return { value: Number.isFinite(n) && n !== 0 ? n : null, unit: normalizeUnit(m[2] || 'mm') };
}

function normalizeUnit(u) {
  const x = String(u || '').trim().toLowerCase();
  if (x === 'm' || x === 'meter' || x === 'metre') return 'meter';
  if (x === 'cm') return 'cm';
  return 'mm';
}

module.exports = { DIM_UNITS, DIM_KEYS, numOrNull, presentDims, formatMaterialDims, parseDimField, normalizeUnit };
