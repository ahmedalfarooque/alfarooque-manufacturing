'use strict';

/* Receipts — real SmartERP receipt documents (ledger entry type 'receipt').
   Same local-first ledger source as Daily Move. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { getReceipts, getLedgerBranches } = require('@/lib/smartlifeTransactionAdapter');
const { parseReportQuery, reportErrorResponse } = require('@/lib/reportQuery');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const parsed = parseReportQuery(req);
  if (parsed.error) return json({ error: parsed.error }, 400);
  try {
    const [result, branches] = await Promise.all([
      getReceipts(sb, parsed.query),
      getLedgerBranches(sb).catch(() => []),
    ]);
    return json({ ...result, branches, filters: parsed.query });
  } catch (error) {
    return reportErrorResponse(json, error);
  }
}
