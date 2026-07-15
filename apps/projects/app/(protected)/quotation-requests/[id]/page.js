'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { STATUS_BADGE } from '../page';
import { GlassButton } from '@/components/glass';

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

  if (error) return <Shell active="/quotation-requests"><div className="text-red-500">{error}</div></Shell>;
  if (!row) return <Shell active="/quotation-requests"><div className="text-[#7C9296]">{t('common.loading')}</div></Shell>;

  const customerName = row.customer?.company_name_en || row.customer?.company_name_ar || row.customer?.company_name || '—';

  return (
    <Shell active="/quotation-requests">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold" dir="ltr">{row.quote_number}</h2>
            <p className="text-xs text-slate-500">{t('qr.breadcrumb')}</p>
          </div>
          <span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[row.status] || '')}>{trEnum(t, 'status', row.status)}</span>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-slate-400">{t('qr.col.customer')}</span><span>{customerName}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('qr.col.amount')}</span><span dir="ltr">{money(row.amount)}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('qr.col.date')}</span><span>{row.quotation?.quote_date || '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('qr.col.currentStatus')}</span><span className="capitalize">{row.quotation?.status ? trEnum(t, 'status', row.quotation.status) : '—'}</span></div>
          <div className="flex justify-between"><span className="text-slate-400">{t('pd.requestedBy')}</span><span>{row.requested_by_name || '—'}</span></div>
          {row.customer?.email && <div className="flex justify-between"><span className="text-slate-400">{t('common.email')}</span><span dir="ltr">{row.customer.email}</span></div>}
          {row.customer?.mobile_number && <div className="flex justify-between"><span className="text-slate-400">{t('cust.col.mobile')}</span><span dir="ltr">{row.customer.mobile_number}</span></div>}
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 flex flex-wrap items-center gap-2">
          {row.status === 'pending' && (
            <>
              <GlassButton variant="success" className="text-sm px-3 py-2" disabled={busy} onClick={() => setStatus('accepted')}>{t('qr.accept')}</GlassButton>
              <GlassButton variant="warning" className="text-sm px-3 py-2" disabled={busy} onClick={() => setStatus('on_hold')}>{t('qr.hold')}</GlassButton>
              <GlassButton variant="danger" className="text-sm px-3 py-2" disabled={busy} onClick={() => setStatus('rejected')}>{t('qr.reject')}</GlassButton>
            </>
          )}
          {['accepted', 'on_hold'].includes(row.status) && !row.project_id && (
            <GlassButton variant="primary" className="text-sm px-3 py-2" disabled={busy} onClick={startProject}>{t('qr.projectStart')}</GlassButton>
          )}
          {row.project_id && (
            <a href={'/projects/' + row.project_id} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">↗ {t('qr.openProject')}</a>
          )}
          <a href="/quotation-requests" className="text-sm text-slate-400 hover:underline ms-auto">‹ {t('qr.title')}</a>
        </div>
      </div>
    </Shell>
  );
}
