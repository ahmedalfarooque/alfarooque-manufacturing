'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button, Modal, Textarea, Field } from '@/components/ui';
import { STATUS_BADGE } from '../page';

function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 }); }

export default function QuotationRequestDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [row, setRow] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState(null);
  const [reason, setReason] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/quotation-requests/${id}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setRow(d.quotationRequest))
      .catch(() => setError(t('common.genericError')));
  }, [id, t]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => setIsAdmin(d?.user?.role === 'admin')).catch(() => {});
    fetch('/api/app-permissions', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => setCanDelete(!!d?.can_delete)).catch(() => {});
  }, []);

  async function setStatus(status, note = '') {
    setBusy(true);
    const res = await fetch(`/api/quotation-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status, note }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (res && res.ok) { setDecision(null); setReason(''); load(); } else alert(data.error || t('common.genericError'));
  }

  async function deleteRequest() {
    if (!window.confirm(`Delete Quotation Approval Request ${row.quote_number}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/quotation-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) { alert(data.error || t('common.genericError')); return; }
    window.location.href = '/quotation-requests';
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
          {row.note && <div className="pt-2 border-t border-[color:var(--bd)]"><span className="text-[color:var(--tx-3)]">Reason: </span><span>{row.note}</span></div>}
        </div>

        <div className="glass-card overflow-hidden">
          <div className="px-4 py-3 font-semibold border-b border-[color:var(--bd)]">Quotation Items</div>
          <div className="overflow-x-auto"><table className="gtable w-full"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Price</th></tr></thead><tbody>
            {(row.products || []).map((p, i) => <tr key={p.id}><td>{i + 1}</td><td>{p.name_en || p.name_ar || p.name || '—'}</td><td dir="ltr">{p.qty}</td><td>{p.unit || '—'}</td><td dir="ltr">{money(p.unit_price)}</td></tr>)}
            {!(row.products || []).length && <tr><td colSpan={5} className="text-center text-[color:var(--tx-3)] py-6">No quotation items.</td></tr>}
          </tbody></table></div>
        </div>

        <div className="glass-card glass-card--pad">
          <div className="font-semibold mb-3">Workflow History</div>
          <div className="space-y-3">{(row.history || []).map((e, i) => <div key={i} className="border-s-2 border-[color:var(--bd-2)] ps-3 text-sm"><div className="font-medium capitalize">{String(e.event || '').replaceAll('_', ' ')}</div><div className="text-xs text-[color:var(--tx-3)]">{new Date(e.created_at).toLocaleString()} · {e.actor_name || 'System'}</div>{e.detail?.reason && <div className="mt-1">{e.detail.reason}</div>}</div>)}</div>
        </div>

        <div className="glass-card glass-card--pad flex flex-wrap items-center gap-2">
          {isAdmin && row.status === 'pending' && (
            <>
              <button disabled={busy} onClick={() => setStatus('approved')} className="gbtn gbtn-success gbtn--sm disabled:opacity-50">{t('qr.accept')}</button>
              <button disabled={busy} onClick={() => setDecision('rejected')} className="gbtn gbtn-danger gbtn--sm disabled:opacity-50">{t('qr.reject')}</button>
            </>
          )}
          {row.project_id && (
            <a href={'/projects/' + row.project_id} className="text-sm px-3 py-2 rounded-lg border border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)] transition-colors duration-200">↗ {t('qr.openProject')}</a>
          )}
          {canDelete && !row.project_id && (
            <button data-delete-control="true" disabled={busy} onClick={deleteRequest} className="gbtn gbtn-danger gbtn--sm disabled:opacity-50">{t('common.delete')}</button>
          )}
          <a href="/quotation-requests" className="text-sm text-[color:var(--tx-3)] hover:underline ms-auto">‹ {t('qr.title')}</a>
        </div>
      </div>
      {decision && <Modal title={t('qr.reject')} onClose={() => { setDecision(null); setReason(''); }} footer={<><Button variant="secondary" onClick={() => { setDecision(null); setReason(''); }}>{t('common.cancel')}</Button><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => setStatus('rejected', reason)}>{t('common.save')}</Button></>}><Field label="Reason" required><Textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} rows={4} /></Field></Modal>}
    </Shell>
  );
}
