'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   SmartERP TRANSACTION ADAPTER — Daily Move / Receipts / Cash Receipts
   ═══════════════════════════════════════════════════════════════════════

   Purpose: isolate the "does SmartERP expose itemized transaction data yet"
   question behind one small module, so that when the vendor eventually adds
   the required endpoint(s), only THIS FILE (plus the matching path added to
   apps/shared/integrationPlatform.js) changes — the Financial Reports route,
   the report-shell pages, and the PDF export never need to be touched again.

   Investigated and confirmed absent across three independent passes:
     - the authorized SmartERP v3 API whitelist (apps/shared/
       integrationPlatform.js) has no bulk journal/ledger LIST endpoint
       (only accounting/get_entry/{id}, a single entry by numeric ID — no
       way to enumerate entries for a date range) and no receipts/payments
       endpoint of any kind.
     - the legacy 2021 v1.0 Postman collection ("ERPAPI Last") — a POS-era
       API surface (products/brands/categories/units/warehouses/tax/
       customers/suppliers/sales/gift-cards/info) — was read in full and
       contains no journal, ledger, receipt, or cash-transaction resource
       either.
     - clientsBalance/suppliersBalance/salesReferences/purchasesReferences
       (the four previously-unused whitelisted misc-read endpoints) were
       live-tested with real data: they return reference-number strings and
       company-wide aggregate totals only — no itemized transaction records.
     - erp_project_payments (the one local table shaped for this data) has
       0 rows.
   None of the three functions below fabricate a substitute for this real
   gap — each returns an honest "SmartERP transaction API required" result.
   This is a genuine external blocker, not a sync failure: the integration
   itself is healthy, the vendor simply has not published the endpoint yet.
   ═══════════════════════════════════════════════════════════════════════ */

const STATUS_LABEL = 'SmartERP transaction API required';

/* ── Daily Move ──────────────────────────────────────────────────────────
   REQUIRED FROM SMARTERP (not implemented by the vendor today):
     GET /api/v3/accounting/journal?company=&token=&from_date=&to_date=&page=&limit=
   Each row, once real, normalizes to:
     {
       transaction_id, date, time,
       reference_number, document_number,
       account_number, account_name, description, transaction_type,
       debit, credit, amount, balance,
       customer_id, customer_name, supplier_id, supplier_name,
       payment_method, branch_id, branch_name, warehouse_id, warehouse_name,
       currency,
     }
   ADAPTER HOOK: once SmartERP documents this endpoint, add its path to
   SMARTLIFE_MISC_READ (or SMARTLIFE_RESOURCES) in
   apps/shared/integrationPlatform.js, then replace the body below with a
   real paginated call (mirroring readAccountBalances's pattern) and map
   each entry into the shape above. Nothing else changes. */
async function getDailyMove(sb, { from, to } = {}) {
  return unavailableResult('No bulk journal/ledger list endpoint exists in the authorized SmartERP API — only accounting/get_entry/{id} (single entry by numeric ID), with no way to enumerate entries for a date range.');
}

/* ── Receipts ────────────────────────────────────────────────────────────
   REQUIRED FROM SMARTERP:
     GET /api/v3/accounting/receipts?company=&token=&from_date=&to_date=&page=&limit=
   Each row, once real, normalizes to:
     {
       receipt_id, receipt_number, date,
       customer, account, invoice_reference,
       payment_method, amount, currency,
       description, branch, warehouse, status,
     }
   ADAPTER HOOK: same pattern as getDailyMove; also confirm the sync job
   actually populates a local table (erp_project_payments or a new
   dedicated one) before trusting rows read from it here. */
async function getReceipts(sb, { from, to } = {}) {
  return unavailableResult('No itemized receipt/payment endpoint exists in the authorized SmartERP API, and no synchronized local dataset for this exists (erp_project_payments has 0 rows).');
}

/* ── Cash Receipts ───────────────────────────────────────────────────────
   REQUIRED FROM SMARTERP:
     GET /api/v3/accounting/receipts?company=&token=&from_date=&to_date=&type=cash&page=&limit=
   (or a dedicated cash-receipts path — exact contract to be confirmed with
   the vendor). Each row, once real, normalizes to:
     {
       receipt_id, receipt_number, date,
       cash_account, customer, payment_method, amount, currency,
       reference, description, branch, warehouse, status,
     }
   Kept as a separate function (not an alias of getReceipts) because
   SmartLife itself treats Receipts and Cash Receipts as distinct
   workflows — do not merge them once real data exists. */
async function getCashReceipts(sb, { from, to } = {}) {
  return unavailableResult('No itemized cash-receipt endpoint exists in the authorized SmartERP API, and no synchronized local dataset for this exists (erp_project_payments has 0 rows).');
}

function unavailableResult(reason) {
  return {
    available: false,
    statusLabel: STATUS_LABEL,
    reason,
    records: [],
    totals: null,
  };
}

module.exports = { getDailyMove, getReceipts, getCashReceipts, STATUS_LABEL };
