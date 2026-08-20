'use client';

import LedgerReport from '@/components/LedgerReport';

/* One row per real SmartERP cash-receipt document (ledger entry type
   'catch_receipt' — SmartERP's own key for a cash receipt). */
const COLUMNS = [
  { key: 'receipt_number', label: 'Receipt #' },
  { key: 'reference', label: 'Reference' },
  { key: 'date', label: 'Date' },
  { key: 'debit_account_number', label: 'Cash A/C #' },
  { key: 'debit_account', label: 'Cash Account (Debit)' },
  { key: 'credit_account_number', label: 'Credit A/C #' },
  { key: 'credit_account', label: 'Credit Account' },
  { key: 'description', label: 'Description', wide: true },
  { key: 'cost_center', label: 'Cost Center' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'branch', label: 'Branch' },
];

const TOTALS = [
  { label: 'Cash Receipts', key: 'rows', numeric: false },
  { label: 'Total Amount', key: 'amount' },
];

export default function CashReceiptsPage() {
  return (
    <LedgerReport
      title="Cash Receipts"
      description="SmartERP cash-receipt documents from the synchronized general ledger"
      apiPath="/api/smartlife/cash-receipts"
      columns={COLUMNS}
      totalsSpec={TOTALS}
    />
  );
}
