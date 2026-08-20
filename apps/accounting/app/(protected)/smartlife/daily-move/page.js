'use client';

import LedgerReport from '@/components/LedgerReport';

/* One row per real journal LINE — the SmartLife "Daily Move" listing. */
const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'document_number', label: 'Entry #' },
  { key: 'reference_number', label: 'Reference' },
  { key: 'transaction_type', label: 'Type' },
  { key: 'account_number', label: 'Account #' },
  { key: 'account_name', label: 'Account' },
  { key: 'description', label: 'Description', wide: true },
  { key: 'cost_center', label: 'Cost Center' },
  { key: 'debit', label: 'Debit', numeric: true },
  { key: 'credit', label: 'Credit', numeric: true },
  { key: 'balance', label: 'Balance', numeric: true },
  { key: 'branch_name', label: 'Branch' },
];

const TOTALS = [
  { label: 'Rows', key: 'rows', numeric: false },
  { label: 'Total Debit', key: 'debit' },
  { label: 'Total Credit', key: 'credit' },
  { label: 'Net (Debit − Credit)', key: 'net' },
];

export default function DailyMovePage() {
  return (
    <LedgerReport
      title="Daily Move"
      description="Journal/ledger movement from the synchronized SmartERP general ledger"
      apiPath="/api/smartlife/daily-move"
      columns={COLUMNS}
      totalsSpec={TOTALS}
    />
  );
}
