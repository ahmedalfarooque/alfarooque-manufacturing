'use client';

import BlockedTransactionReport from '@/components/BlockedTransactionReport';

const COLUMNS = [
  { key: 'date', label: 'Date' },
  { key: 'time', label: 'Time' },
  { key: 'reference_number', label: 'Reference' },
  { key: 'document_number', label: 'Document #' },
  { key: 'account_number', label: 'Account #' },
  { key: 'account_name', label: 'Account' },
  { key: 'description', label: 'Description' },
  { key: 'transaction_type', label: 'Type' },
  { key: 'debit', label: 'Debit', numeric: true },
  { key: 'credit', label: 'Credit', numeric: true },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'balance', label: 'Balance', numeric: true },
  { key: 'customer_name', label: 'Customer' },
  { key: 'supplier_name', label: 'Supplier' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'branch_name', label: 'Branch' },
  { key: 'warehouse_name', label: 'Warehouse' },
];

export default function DailyMovePage() {
  return (
    <BlockedTransactionReport
      title="Daily Move"
      description="Day-by-day journal/ledger movement — requires a real SmartERP transaction endpoint"
      apiPath="/api/smartlife/daily-move"
      columns={COLUMNS}
    />
  );
}
