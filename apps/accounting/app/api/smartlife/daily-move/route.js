'use strict';

/* Daily Move — real SmartERP general-ledger movement. Reads the locally
   synchronized ledger (erp_smartlife_journal_entries / _journal_lines, fed
   by apps/shared/journalEntries.js from accounting/get_entry/{id}), never
   SmartERP live on a page load. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { getDailyMove, getLedgerBranches } = require('@/lib/smartlifeTransactionAdapter');
const { parseReportQuery, reportErrorResponse } = require('@/lib/reportQuery');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const parsed = parseReportQuery(req);
  if (parsed.error) return json({ error: parsed.error }, 400);
  try {
    const [result, branches] = await Promise.all([
      getDailyMove(sb, parsed.query),
      getLedgerBranches(sb).catch(() => []),
    ]);
    return json({ ...result, branches, filters: parsed.query });
  } catch (error) {
    return reportErrorResponse(json, error);
  }
}
