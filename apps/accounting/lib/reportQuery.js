'use strict';

/* Shared query parsing + error shaping for the ledger-backed transaction
   reports (Daily Move / Receipts / Cash Receipts), so all three validate
   identically and none can silently accept a malformed date. */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SORT_FIELDS = new Set(['entry', 'reference', 'date', 'account_number', 'account_name', 'type', 'debit', 'credit', 'amount']);

function parseReportQuery(req) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get('from') || '').trim();
  const to = (searchParams.get('to') || '').trim();
  const branchId = (searchParams.get('branch') || '').trim();
  const sort = (searchParams.get('sort') || '').trim();
  const direction = (searchParams.get('dir') || '').trim().toLowerCase();

  for (const [label, value] of [['from', from], ['to', to]]) {
    if (value && !DATE_RE.test(value)) return { error: `Invalid ${label} date — expected YYYY-MM-DD.` };
    if (value && Number.isNaN(Date.parse(value))) return { error: `Invalid ${label} date.` };
  }
  if (from && to && from > to) return { error: 'The "from" date must not be after the "to" date.' };
  if (sort && !SORT_FIELDS.has(sort)) return { error: 'Unsupported sort field.' };
  if (direction && direction !== 'asc' && direction !== 'desc') return { error: 'Sort direction must be asc or desc.' };

  return {
    query: {
      from: from || null, to: to || null, branchId: branchId || null,
      /* Default: record number ascending — SmartLife's own Daily Move
         default ordering, not date. */
      sort: sort || 'entry',
      direction: direction || 'asc',
    },
  };
}

/* Never leak a database/SmartERP internal message to the browser — the UI
   only needs to know the report could not be loaded. */
function reportErrorResponse(json, error) {
  const message = String(error?.message || '');
  const missingLedger = /journal_entries|journal_lines|relation .* does not exist/i.test(message);
  return json({
    error: missingLedger
      ? 'The synchronized ledger tables are not available yet. Run a SmartLife synchronization first.'
      : 'Could not load the report.',
  }, missingLedger ? 503 : 500);
}

module.exports = { parseReportQuery, reportErrorResponse };
