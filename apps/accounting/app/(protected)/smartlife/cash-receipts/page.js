'use client';

/* Report definition (title, columns, sorts, totals) lives in
   lib/ledgerReportDefs.js so the table, PDF, Excel and print output can
   never drift apart. */

import LedgerReport from '@/components/LedgerReport';

export default function Page() {
  return <LedgerReport reportKey="cash-receipts" />;
}
