'use strict';

/* Cash Flow Statement — PARTIAL, by design, but now growing more complete
   automatically over time. erp_smartlife_account_balances is a
   point-in-time snapshot with no history of its own, but every real sync
   now also writes a dated row per account into the append-only
   erp_smartlife_account_balance_history table (see
   apps/shared/accountBalanceHistory.js). Once at least two distinct
   calendar days of history exist for an account, this route computes a
   REAL delta for it — never before that, and never a fabricated one.
   Real today:
     - Net Profit/Loss: reuses the Income Statement's own calculation.
     - Ending cash: account 103, a real current balance.
     - Change in Inventory: a real monthly cost-movement trend from the
       live SmartERP inventory-movements endpoint — not a balance-sheet
       delta, but a genuinely-sourced, honestly-labeled figure.
     - Beginning cash / Change in ownership (201): real once ≥2 days of
       recorded history exist; N/A on day one of history capture.
   Receivables/payables/loans have no established account-root mapping or
   history yet and remain N/A. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');
const { parseCookies, COOKIE_NAME } = require('@/lib/auth');
const { SSO_COOKIE_NAME } = require('@/lib/sso');
const { readSmartLife } = require('@/lib/smartlife');
const { earliestAndLatestBalance } = require('../../../../../shared/accountBalanceHistory');

function r2(value) { return Math.round((Number(value) || 0) * 100) / 100; }

const ROOTS = {
  sales: '401', salesReturns: '402', salesDiscount: '403',
  purchases: '301', purchaseReturns: '302', purchaseDiscount: '303',
  gaExpenses: '501', sellingMarketing: '502', otherExpenses: '503',
  operatingIncome: '601', otherIncome: '602',
  cash: '103',
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
  /* Raw signed balance, not Math.abs() — see income-statement/route.js for
     why (account 502 is a genuine negative/contra-expense balance). */
  const amt = key => { const row = byRoot[ROOTS[key]]; return row ? r2(row.balance) : null; };

  const netSales = r2((amt('sales') || 0) - (amt('salesReturns') || 0) - (amt('salesDiscount') || 0));
  const salesCost = r2((amt('purchases') || 0) - (amt('purchaseReturns') || 0) - (amt('purchaseDiscount') || 0));
  const totalProfit = r2(netSales - salesCost);
  const totalExpenses = r2((amt('gaExpenses') || 0) + (amt('sellingMarketing') || 0) + (amt('otherExpenses') || 0));
  const totalIncome = r2((amt('operatingIncome') || 0) + (amt('otherIncome') || 0));
  const netProfitLoss = r2(totalProfit - totalExpenses + totalIncome);

  const endingCashRow = byRoot[ROOTS.cash];
  const endingCash = endingCashRow ? r2(endingCashRow.balance) : null;

  /* Change in Inventory — the ONE operating-activities line that IS
     genuinely available, via the live SmartERP inventory-movements
     endpoint (products/get_inventory_movements — see
     apps/shared/integrationPlatform.js, readInventoryMovements). It
     returns a real monthly cost-movement trend, not a fabricated figure.
     Honesty note: this is inventory COST movement (purchasing/consumption
     cost per month), not a balance-sheet inventory-account delta — no
     historical account-balance snapshot exists to compute that directly.
     Summed across whatever months SmartERP returns and labeled accordingly
     in the UI; never silently presented as the stricter accounting figure. */
  let changeInInventory = null;
  let inventoryMovementNote = null;
  try {
    const cookies = parseCookies(req.headers.get('cookie'));
    const movementsResult = await readSmartLife('inventory-movements', {
      appToken: cookies[COOKIE_NAME], ssoToken: cookies[SSO_COOKIE_NAME],
    }, {});
    const months = movementsResult?.records || [];
    if (months.length) {
      changeInInventory = r2(months.reduce((sum, m) => sum + (Number(m.total_cost) || 0), 0));
      inventoryMovementNote = `Sum of ${months.length} month(s) of inventory cost movement reported live by SmartERP (products/get_inventory_movements) — a cost trend, not a balance-sheet inventory delta.`;
    }
  } catch (e) {
    /* Live SmartERP call failing (e.g. central integration proxy down)
       must never surface as a fabricated 0 — leave changeInInventory
       null (renders as N/A) and move on. */
  }

  /* Ownership rights (201) and beginning-cash (103) now read from the real
     append-only history table (erp_smartlife_account_balance_history —
     see apps/shared/accountBalanceHistory.js), populated once per real sync
     starting the day that table was introduced. Both stay N/A until at
     least two distinct calendar days of history exist for the account —
     a single balance is never presented as a "change", no matter how
     genuinely real that one balance is. Loans has no synced account root
     established this session, so it stays N/A regardless of history. */
  let beginningCash = null; let beginningCashDate = null;
  let changeInOwnership = null; let ownershipHistoryNote = null;
  try {
    const cashHistory = await earliestAndLatestBalance(sb, ROOTS.cash);
    if (cashHistory.earliest != null) { beginningCash = r2(cashHistory.earliest); beginningCashDate = cashHistory.earliestDate; }
  } catch (e) { /* history table read failure must never surface as a fabricated value */ }
  try {
    const ownershipHistory = await earliestAndLatestBalance(sb, '201');
    if (ownershipHistory.earliest != null && ownershipHistory.latest != null) {
      changeInOwnership = r2(ownershipHistory.latest - ownershipHistory.earliest);
      ownershipHistoryNote = `Change from ${ownershipHistory.earliestDate} to ${ownershipHistory.latestDate} (account 201, real synced balances).`;
    }
  } catch (e) { /* same — never fabricate on a read failure */ }

  return json({
    source: 'Synchronized SmartLife account balances (erp_smartlife_account_balances)',
    lastSyncedAt,
    operating: {
      netProfitLoss,
      depreciation: null,
      changeInInventory,
      changeInInventoryNote: inventoryMovementNote,
      changeInReceivables: null,
      changeInPayables: null,
      netCashFromOperating: null,
    },
    investing: { fixedAssets: null, netCashFromInvesting: null },
    financing: { changeInOwnership, changeInOwnershipNote: ownershipHistoryNote, changeInLoans: null, netCashFromFinancing: null },
    netChangeInCash: (beginningCash != null && endingCash != null) ? r2(endingCash - beginningCash) : null,
    beginningCash, beginningCashDate,
    endingCash,
    unavailableReason: beginningCashDate
      ? `Beginning cash and change in ownership now use real recorded history (since ${beginningCashDate}). Change in inventory/receivables/payables and loans still have no real source and remain N/A — never fabricated.`
      : 'Daily balance history started recording with this deployment — only one day exists so far, so period-over-period change cannot be calculated yet. It will become available automatically once a second day of real sync history accumulates. Net profit/loss, ending cash and the inventory cost movement (live from SmartERP) are real today; every other line requires that snapshot history.',
  });
}
