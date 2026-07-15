'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button } from '@/components/ui';
import { STATUS_BADGE } from '../page';

function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); }

export default function QuotationRequestDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/quotation-requests/${id}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRow(d.quotationRequest))
      .catch(() => setError(t('common.genericError')));
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(status) {
    setBusy(true);
    const res = await fetch(`/api/quotation-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) load(); else alert(t('common.genericError'));
  }

  async function startProject() {
    setBusy(true);
    const res = await fetch(`/api/quotation-requests/${id}/start-project`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) { alert(d.error || t('common.genericError')); return; }
    if (d.project?.id) window.location.href = '/projects/' + d.project.id;
  }

  if (error) return <Shell active="/quotation-requests"><div className="text-[#ef4444]">{error}</div></Shell>;
  if (!row) return <Shell active="/quotation-requests"><div className="text-[color:var(--tx-3)]">{t('common.loading')}</div></Shell>;

  const customerName = row.customer?.company_name_en || row.customer?.company_name_ar || row.customer?.company_name || '—';

  return (
    <Shell active="/quotation-requests">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold" dir="ltr">{row.quote_number}</h2>
            <p className="text-xs text-[color:var(--tx-3)]">{t('qr.breadcrumb')}</p>
          </div>
          <span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[row.status] || '')}>{trEnum(t, 'status', row.status)}</span>
        </div>

        <div className="glass-card glass-card--pad space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('qr.col.customer')}</span><span>{customerName}</span></div>
          <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('qr.col.amount')}</span><span dir="ltr">{money(row.amount)}</span></div>
          <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('qr.col.date')}</span><span>{row.quotation?.quote_date || '—'}</span></div>
          <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('qr.col.currentStatus')}</span><span className="capitalize">{row.quotation?.status ? trEnum(t, 'status', row.quotation.status) : '—'}</span></div>
          <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('pd.requestedBy')}</span><span>{row.requested_by_name || '—'}</span></div>
          {row.customer?.email && <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('common.email')}</span><span dir="ltr">{row.customer.email}</span></div>}
          {row.customer?.mobile_number && <div className="flex justify-between"><span className="text-[color:var(--tx-3)]">{t('cust.col.mobile')}</span><span dir="ltr">{row.customer.mobile_number}</span></div>}
        </div>

        <div className="glass-card glass-card--pad flex flex-wrap items-center gap-2">
          {row.status === 'pending' && (
            <>
              <button disabled={busy} onClick={() => setStatus('accepted')} className="gbtn gbtn-success gbtn--sm disabled:opacity-50">{t('qr.accept')}</button>
              <button disabled={busy} onClick={() => setStatus('on_hold')} className="gbtn gbtn-warning gbtn--sm disabled:opacity-50">{t('qr.hold')}</button>
              <button disabled={busy} onClick={() => setStatus('rejected')} className="gbtn gbtn-danger gbtn--sm disabled:opacity-50">{t('qr.reject')}</button>
            </>
          )}
          {['accepted', 'on_hold'].includes(row.status) && !row.project_id && (
            <Button disabled={busy} onClick={startProject}>{t('qr.projectStart')}</Button>
          )}
          {row.project_id && (
            <a href={'/projects/' + row.project_id} className="text-sm px-3 py-2 rounded-lg border border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)] transition-colors duration-200">↗ {t('qr.openProject')}</a>
          )}
          <a href="/quotation-requests" className="text-sm text-[color:var(--tx-3)] hover:underline ms-auto">‹ {t('qr.title')}</a>
        </div>
      </div>
    </Shell>
  );
}
