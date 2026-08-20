'use client';

import LedgerReport from '@/components/LedgerReport';

/* One row per real SmartERP receipt document (ledger entry type 'receipt').
   Both posted sides are shown exactly as SmartERP records them rather than
   guessing which side is the customer. */
const COLUMNS = [
  { key: 'receipt_number', label: 'Receipt #' },
  { key: 'reference', label: 'Reference' },
  { key: 'date', label: 'Date' },
  { key: 'debit_account_number', label: 'Debit A/C #' },
  { key: 'debit_account', label: 'Debit Account' },
  { key: 'credit_account_number', label: 'Credit A/C #' },
  { key: 'credit_account', label: 'Credit Account' },
  { key: 'description', label: 'Description', wide: true },
  { key: 'cost_center', label: 'Cost Center' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'branch', label: 'Branch' },
];

const TOTALS = [
  { label: 'Receipts', key: 'rows', numeric: false },
  { label: 'Total Amount', key: 'amount' },
];

export default function ReceiptsPage() {
  return (
    <LedgerReport
      title="Receipts"
      description="SmartERP receipt documents from the synchronized general ledger"
      apiPath="/api/smartlife/receipts"
      columns={COLUMNS}
      totalsSpec={TOTALS}
    />
  );
}
