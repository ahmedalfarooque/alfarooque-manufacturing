'use client';

import BlockedTransactionReport from '@/components/BlockedTransactionReport';

const COLUMNS = [
  { key: 'receipt_number', label: 'Receipt #' },
  { key: 'date', label: 'Date' },
  { key: 'cash_account', label: 'Cash Account' },
  { key: 'customer', label: 'Customer' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'reference', label: 'Reference' },
  { key: 'description', label: 'Description' },
  { key: 'branch', label: 'Branch' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'status', label: 'Status' },
];

export default function CashReceiptsPage() {
  return (
    <BlockedTransactionReport
      title="Cash Receipts"
      description="Cash-account receipt records — requires a real SmartERP transaction endpoint"
      apiPath="/api/smartlife/cash-receipts"
      columns={COLUMNS}
    />
  );
}
