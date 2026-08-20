'use client';

import BlockedTransactionReport from '@/components/BlockedTransactionReport';

const COLUMNS = [
  { key: 'receipt_number', label: 'Receipt #' },
  { key: 'date', label: 'Date' },
  { key: 'customer', label: 'Customer' },
  { key: 'account', label: 'Account' },
  { key: 'invoice_reference', label: 'Invoice / Reference' },
  { key: 'payment_method', label: 'Payment Method' },
  { key: 'amount', label: 'Amount', numeric: true },
  { key: 'currency', label: 'Currency' },
  { key: 'description', label: 'Description' },
  { key: 'branch', label: 'Branch' },
  { key: 'warehouse', label: 'Warehouse' },
  { key: 'status', label: 'Status' },
];

export default function ReceiptsPage() {
  return (
    <BlockedTransactionReport
      title="Receipts"
      description="Customer receipt/payment records — requires a real SmartERP transaction endpoint"
      apiPath="/api/smartlife/receipts"
      columns={COLUMNS}
    />
  );
}
