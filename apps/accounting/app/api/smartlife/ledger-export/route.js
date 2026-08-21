'use strict';

/* One export endpoint for all three ledger reports — Excel today, and the
   single place any future server-side format would go. It resolves the
   report definition and the adapter function from the same registry the UI
   uses, so an export can never be built from a different column set or a
   different query than the screen. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { LEDGER_REPORTS, totalsFor } = require('@/lib/ledgerReportDefs');
const { parseReportQuery, reportErrorResponse } = require('@/lib/reportQuery');
const { getDailyMove, getReceipts, getCashReceipts, getLedgerBranches } = require('@/lib/smartlifeTransactionAdapter');
const { buildLedgerWorkbook } = require('@/lib/reportExcel');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOADERS = {
  'daily-move': getDailyMove,
  receipts: getReceipts,
  'cash-receipts': getCashReceipts,
};

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const { searchParams } = new URL(req.url);
  const reportKey = (searchParams.get('report') || '').trim();
  const report = LEDGER_REPORTS[reportKey];
  const loader = LOADERS[reportKey];
  if (!report || !loader) return json({ error: 'Unknown report.' }, 400);

  const parsed = parseReportQuery(req);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const sb = getDb();
  try {
    const result = await loader(sb, parsed.query);
    let branchLabel = 'All branches';
    if (parsed.query.branchId) {
      const branches = await getLedgerBranches(sb).catch(() => []);
      branchLabel = branches.find(b => String(b.id) === String(parsed.query.branchId))?.name || parsed.query.branchId;
    }
    const buffer = await buildLedgerWorkbook({
      report,
      rows: result.records || [],
      totals: totalsFor(report, result.totals),
      filters: parsed.query,
      companyName: 'ALFAROOQUE WOOD WORKS FACTORY',
      branchLabel,
    });
    const stamp = [parsed.query.from, parsed.query.to].filter(Boolean).join('_') || 'all-dates';
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${reportKey}-${stamp}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return reportErrorResponse(json, error);
  }
}
