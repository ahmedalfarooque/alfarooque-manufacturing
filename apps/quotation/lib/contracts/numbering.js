/* Contract numbering — PURE helpers, no DB.
   Format: CT-YYYY-NNNN (zero-padded sequence within the year), mirroring
   the quotation WW-03-YYYY-NNNN convention's shape. The DB/service layer
   supplies the year's current max sequence; these helpers only format and
   parse, so they are fully testable without a database. */

export const CONTRACT_PREFIX = 'CT';

export function formatContractNumber(year, seq, prefix = CONTRACT_PREFIX) {
  const y = String(year);
  const n = String(Math.max(1, Number(seq) || 1)).padStart(4, '0');
  return `${prefix}-${y}-${n}`;
}

/* Parse "CT-2026-0007" → { prefix, year, seq } or null. */
export function parseContractNumber(str) {
  const m = /^([A-Z]{2,4})-(\d{4})-(\d{1,6})$/.exec(String(str || '').trim());
  if (!m) return null;
  return { prefix: m[1], year: Number(m[2]), seq: Number(m[3]) };
}

/* Given the highest existing number for a year (or null), return the next.
   The service layer passes the current max; this stays DB-free. */
export function nextContractNumber(year, currentMaxNumber, prefix = CONTRACT_PREFIX) {
  const parsed = currentMaxNumber ? parseContractNumber(currentMaxNumber) : null;
  const seq = parsed && parsed.year === Number(year) ? parsed.seq + 1 : 1;
  return formatContractNumber(year, seq, prefix);
}
