'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { GlassBadge, GlassSkeletonRows } from '@/components/glass';
import { SectionCard, CRMEmptyRow } from '@/components/CRMWidgets';
import { getAppUrl } from '@/lib/appLinks';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

/* Per spec: no new storage or document viewer. This page only surfaces
   read-only links into existing, already-owned records: QuotePro
   quotations (qt_quotations, global list capped at 50, same table
   /contacts/[id]'s Customer 360 already reads) and SmartLife invoice
   snapshot records (erp_financial_source_records, same source Dashboard's
   Recent Sales Invoices card already reads). */
export default function DocumentsPage() {
  const { t } = useLang();
  const [quotations, setQuotations] = useState(null);
  const [invoices, setInvoices] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/documents').then(r => r.json()).then(body => {
      if (cancelled) return;
      setQuotations(body.quotations || []);
      setInvoices(body.invoices || []);
    }).catch(() => { if (!cancelled) { setQuotations([]); setInvoices([]); } });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('documents')}</h1>

      <SectionCard title="Quotations" subtitle="From QuotePro" action="Open QuotePro" actionHref={`${getAppUrl('quotation')}/quotations`}>
        {quotations === null ? <GlassSkeletonRows rows={4} cols={3} /> : !quotations.length ? (
          <CRMEmptyRow text="No quotations found." />
        ) : (
          <div className="space-y-1">
            {quotations.map(q => (
              <div key={q.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--tx)] truncate" dir="ltr">{q.quote_number}</p>
                  <p className="text-xs text-[color:var(--tx-4)] truncate" dir="ltr">{q.created_at ? String(q.created_at).slice(0, 10) : '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[color:var(--tx-3)] tabular-nums" dir="ltr">SAR {fmt(q.grand_total)}</span>
                  <GlassBadge tone="cyan">{q.status}</GlassBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Invoices" subtitle="SmartLife-synchronized sales invoices">
        {invoices === null ? <GlassSkeletonRows rows={4} cols={3} /> : !invoices.length ? (
          <CRMEmptyRow text="No synchronized invoices found." />
        ) : (
          <div className="space-y-1">
            {invoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--tx)] truncate">{inv.party_name || inv.source_reference || 'Invoice'}</p>
                  <p className="text-xs text-[color:var(--tx-4)] truncate" dir="ltr">{inv.record_date ? String(inv.record_date).slice(0, 10) : '—'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[color:var(--tx-3)] tabular-nums" dir="ltr">SAR {fmt(inv.total_amount)}</span>
                  <GlassBadge tone={inv.balance_amount > 0 ? 'amber' : 'emerald'}>{inv.source_status || (inv.balance_amount > 0 ? 'Outstanding' : 'Paid')}</GlassBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
