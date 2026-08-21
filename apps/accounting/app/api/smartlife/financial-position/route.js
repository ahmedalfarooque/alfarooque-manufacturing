'use strict';

/* Financial Position (Balance Sheet) — built from the same real synced
   erp_smartlife_account_balances snapshot the Income Statement/Trial
   Balance already use. Real account roots (verified live, not guessed):
     101 = Fixed Assets, 102 = Current Assets, 103 = Cash & equivalents
     201 = Equity/Capital, 202 = Non-current Liabilities, 203 = Current Liabilities
   These are point-in-time balances, so a balance sheet (itself a
   point-in-time statement) is a natural fit — unlike Income Statement/Cash
   Flow this needs no period concept at all.

   Equity note: account 201's balance is prior/opening equity — it does not
   yet include the CURRENT year's not-yet-closed net profit/loss. Verified
   live: without adding the current net profit/loss, Assets (393,651.25)
   would not reconcile against Liabilities+Equity (957,091.79) — the gap is
   exactly the Income Statement's Net Loss (563,440.55) to the cent. Adding
   that real, already-computed figure into Equity brings the statement back
   into balance (393,651.25 vs 393,651.24, a one-cent rounding gap) — this
   is a real accounting relationship in the actual synced data, not an
   invented plug. The tiny residual difference is shown as-is, never hidden
   or forced to zero. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

function r2(value) { return Math.round((Number(value) || 0) * 100) / 100; }

const ROOTS = {
  fixedAssets: '101', currentAssets: '102', cash: '103',
  equity: '201', nonCurrentLiabilities: '202', currentLiabilities: '203',
  sales: '401', salesReturns: '402', salesDiscount: '403',
  purchases: '301', purchaseReturns: '302', purchaseDiscount: '303',
  gaExpenses: '501', sellingMarketing: '502', otherExpenses: '503',
  operatingIncome: '601', otherIncome: '602',
};

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();

  const { data, error } = await sb.from('erp_smartlife_account_balances')
    .select('account_number, account_name, balance, last_synced_at')
    .eq('tenant_id', 'alfarooque').eq('source_system', 'smartlife')
    .in('account_number', Object.values(ROOTS));
  if (error) return json({ error: 'Could not load account balances.' }, 500);

  const byRoot = {};
  for (const row of data || []) byRoot[row.account_number] = row;
  const lastSyncedAt = (data || []).find(r => r.last_synced_at)?.last_synced_at || null;

  function line(key) {
    const root = ROOTS[key];
    const row = byRoot[root];
    return { account_number: root, account_name: row?.account_name || null, balance: row ? r2(row.balance) : null, amount: row ? r2(row.balance) : 0, available: !!row };
  }

  const fixedAssets = line('fixedAssets'), currentAssets = line('currentAssets'), cash = line('cash');
  const equityLine = line('equity'), nonCurrentLiabilities = line('nonCurrentLiabilities'), currentLiabilities = line('currentLiabilities');

  /* Net profit/loss — identical calculation to the Income Statement route
     (same account roots, same formula) so the two reports can never
     disagree on this figure. Not re-exported/imported to avoid a cross-route
     runtime dependency for one shared number; kept as an explicit inline
     mirror instead, same as the Cash Flow route already does. */
  const sales = line('sales'), salesReturns = line('salesReturns'), salesDiscount = line('salesDiscount');
  const purchases = line('purchases'), purchaseReturns = line('purchaseReturns'), purchaseDiscount = line('purchaseDiscount');
  const ga = line('gaExpenses'), selling = line('sellingMarketing'), otherExp = line('otherExpenses');
  const opIncome = line('operatingIncome'), otherInc = line('otherIncome');
  const netSales = r2(sales.amount - salesReturns.amount - salesDiscount.amount);
  const salesCost = r2(purchases.amount - purchaseReturns.amount - purchaseDiscount.amount);
  const totalProfit = r2(netSales - salesCost);
  const totalExpenses = r2(ga.amount + selling.amount + otherExp.amount);
  const totalIncome = r2(opIncome.amount + otherInc.amount);
  const netProfitLoss = r2(totalProfit - totalExpenses + totalIncome);

  const totalAssets = r2(fixedAssets.amount + currentAssets.amount + cash.amount);
  const totalLiabilities = r2(nonCurrentLiabilities.amount + currentLiabilities.amount);
  const totalEquity = r2(equityLine.amount + netProfitLoss);
  const totalLiabilitiesAndEquity = r2(totalLiabilities + totalEquity);
  const difference = r2(totalAssets - totalLiabilitiesAndEquity);

  const allAvailable = [fixedAssets, currentAssets, cash, equityLine, nonCurrentLiabilities, currentLiabilities].every(l => l.available);

  return json({
    source: 'Synchronized SmartLife account balances (erp_smartlife_account_balances)',
    lastSyncedAt,
    complete: allAvailable,
    sections: {
      assets: { lines: { fixedAssets, currentAssets, cash }, totalAssets },
      liabilities: { lines: { nonCurrentLiabilities, currentLiabilities }, totalLiabilities },
      equity: { lines: { equity: equityLine, netProfitLoss }, totalEquity },
      totalLiabilitiesAndEquity,
      difference,
    },
    trace: {
      totalAssets: 'account 101 (Fixed Assets) + 102 (Current Assets) + 103 (Cash & Equivalents)',
      totalLiabilities: 'account 202 (Non-current Liabilities) + 203 (Current Liabilities)',
      totalEquity: 'account 201 (Equity/Capital) + current-year Net Profit/Loss (same calculation as the Income Statement route — 201 itself only carries prior/opening equity, not yet closed for the current year)',
      difference: 'Total Assets - (Total Liabilities + Total Equity) — shown as-is; a real rounding/timing gap is never hidden or forced to zero.',
    },
  });
}
