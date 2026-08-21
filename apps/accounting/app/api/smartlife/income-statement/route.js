'use strict';

/* Income Statement — built entirely from erp_smartlife_account_balances,
   the same already-synced snapshot table Trial Balance/Account Balances
   read. No SmartERP endpoint exposes a ready-made Income Statement (SmartERP's
   V3 REST spec has no income_statement resource) — this reconstructs the
   report from real account-root balances instead of fabricating one.

   The account-root -> section mapping below is not a guess: querying the
   synced data shows SmartLife's own chart-of-accounts already groups these
   roots exactly this way (verified against real balances, e.g. account 501
   is literally named "G&A Expenses - مصاريف ادارية وعمومية"). Every number
   below is a real balance from that table; nothing is invented.

   Sign convention: each root's raw signed balance (NOT Math.abs) feeds the
   section math directly — see the `line()` comment below for why (account
   502 is a genuine negative/contra-expense balance in the real synced
   data, verified against a real SmartLife screenshot). The `trace` field
   documents the exact formula per total for auditability. */

const { getDb } = require('@/lib/db');
const { json, requireAction } = require('@/lib/http');

function r2(value) { return Math.round((Number(value) || 0) * 100) / 100; }

const ROOTS = {
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
    /* Use the raw signed balance directly — NOT Math.abs(). Verified against
       a real SmartLife screenshot: account 502 (Selling & Marketing) carries
       a genuinely negative balance in the synced data, and SmartLife's own
       Income Statement sums it as-is (a credit/contra-expense reduces the
       expense total). Taking the absolute value here previously flipped
       that sign and inflated Total Expenses by 2x the account's magnitude —
       confirmed by comparing computed totals against the reference
       screenshot's exact figures before this fix. */
    return {
      account_number: root,
      account_name: row?.account_name || null,
      balance: row ? r2(row.balance) : null,
      amount: row ? r2(row.balance) : 0,
      available: !!row,
    };
  }

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

  const allLinesAvailable = [sales, salesReturns, salesDiscount, purchases, purchaseReturns, purchaseDiscount, ga, selling, otherExp, opIncome, otherInc]
    .every(l => l.available);

  return json({
    source: 'Synchronized SmartLife account balances (erp_smartlife_account_balances)',
    lastSyncedAt,
    complete: allLinesAvailable,
    sections: {
      sales: { lines: { sales, salesReturns, salesDiscount }, netSales },
      salesCost: { lines: { purchases, purchaseReturns, purchaseDiscount }, salesCost },
      totalProfit,
      expenses: { lines: { ga, selling, otherExp }, totalExpenses },
      income: { lines: { opIncome, otherInc }, totalIncome },
      netProfitLoss,
    },
    /* Calculation trace, for auditability (section 13 of the spec) */
    trace: {
      netSales: 'account 401 (Sales) - 402 (Sales Returns) - 403 (Sales Discount)',
      salesCost: 'account 301 (Purchases) - 302 (Purchase Returns) - 303 (Purchase Discount)',
      totalProfit: 'Net Sales - Sales Cost',
      totalExpenses: 'account 501 (G&A) + 502 (Selling & Marketing) + 503 (Other Misc)',
      totalIncome: 'account 601 (Operating Income) + 602 (Other Income)',
      netProfitLoss: 'Total Profit - Total Expenses + Total Income',
    },
  });
}
