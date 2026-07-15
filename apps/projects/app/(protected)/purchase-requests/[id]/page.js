'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { STATUS_BADGE } from '../page';
import { GlassButton } from '@/components/glass';

/* Dynamic status-transition buttons (STATUS_ACTIONS) map to a GlassButton
   variant by semantic meaning of the target status, since the available
   transitions vary per click — mirrors the mapping used in
   app/(protected)/projects/[id]/page.js for PR_ACTIONS. */
function statusActionVariant(to) {
  if (to === 'Rejected' || to === 'Cancelled') return 'danger';
  if (to === 'Approved' || to === 'Delivered' || to === 'Payment Completed') return 'success';
  if (to === 'On Hold') return 'warning';
  return 'secondary';
}

const ALL_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected', 'On Hold', 'Purchased', 'Delivered', 'Cancelled', 'Payment Pending', 'Payment Approved', 'Payment Completed'];
/* Target statuses; button labels resolve through t('pd.act.<status>') at render time. */
const STATUS_ACTIONS = ['Under Review', 'Approved', 'Rejected', 'On Hold', 'Purchased', 'Delivered', 'Payment Pending', 'Payment Approved', 'Payment Completed', 'Cancelled'];
const REFRESH_MS = 10000;

export default function PurchaseRequestDetailPage({ params }) {
  const { t, formatDate } = useLanguage();
  const [me, setMe] = useState(null);
  const { data, error, refresh } = useLiveData(`/api/purchase-requests/${params.id}`, REFRESH_MS);
  const { data: commentsData, refresh: refreshComments } = useLiveData(`/api/purchase-requests/${params.id}/comments`, REFRESH_MS);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const r = data?.purchaseRequest;
  const attachments = data?.attachments || [];
  const comments = commentsData?.comments || [];
  const isAdmin = me?.role === 'admin';

  async function changeStatus(status) {
    setBusy(true);
    try {
      const res = await fetch(`/api/purchase-requests/${params.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || t('prd.couldNotUpdateStatus')); }
      refresh();
    } finally { setBusy(false); }
  }

  async function postComment(e) {
    e.preventDefault();
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/purchase-requests/${params.id}/comments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ comment }),
      });
      if (res.ok) { setComment(''); refreshComments(); }
    } finally { setPosting(false); }
  }

  if (error) return <Shell active="/purchase-requests"><div className="text-red-500 text-sm">{error}</div></Shell>;
  if (!data) return <Shell active="/purchase-requests"><div className="text-slate-400 text-sm">{t('common.loading')}</div></Shell>;
  if (!r) return <Shell active="/purchase-requests"><div className="text-red-500 text-sm">{t('prd.notFound')}</div></Shell>;

  return (
    <Shell active="/purchase-requests">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs text-slate-500 mb-1"><a href="/purchase-requests" className="hover:underline">{t('pr.title')}</a> &gt; {t('prd.breadcrumbDetails')}</p>
          <h2 className="text-lg font-semibold">{r.material_description}</h2>
          <p className="text-xs text-slate-500">
            <a href={'/projects/' + r.project_id} className="hover:underline">{r.project_name}</a> · {r.customer_name}
          </p>
        </div>
        <span className={'px-3 py-1.5 rounded-full text-sm font-medium ' + (STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
            <h3 className="font-medium text-sm mb-3">{t('prd.requestDetails')}</h3>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <Row label={t('pd.requestedBy')} value={r.requested_by_name} />
              <Row label={t('pd.date')} value={r.request_date} />
              <Row label={t('pd.supplier')} value={r.supplier} />
              <Row label={t('pd.priority')} value={trEnum(t, 'status', r.priority)} />
              <Row label={t('pd.quantity')} value={r.quantity ? `${r.quantity} ${r.unit || ''}` : null} />
              <Row label={t('pd.estimatedPrice')} value={r.estimated_price ? `SAR ${Number(r.estimated_price).toLocaleString()}` : null} />
              <Row label={t('pd.requiredDate')} value={r.required_date} />
              <Row label={t('prd.expectedDate')} value={r.expected_date} />
            </dl>
            {r.material_list && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">{t('pd.materialList')}</div>
                <p className="text-sm whitespace-pre-wrap">{r.material_list}</p>
              </div>
            )}
            {r.remarks && (
              <div className="mt-3">
                <div className="text-xs text-slate-500 mb-1">{t('prd.otherNotes')}</div>
                <p className="text-sm whitespace-pre-wrap">{r.remarks}</p>
              </div>
            )}
          </div>

          {attachments.length > 0 && (
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <h3 className="font-medium text-sm mb-3">{t('pd.attachments')}</h3>
              <div className="flex flex-wrap gap-2">
                {attachments.map(a => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-brand-500/40">
                    📎 {a.file_name}{a.label ? ` (${a.label})` : ''}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
            <h3 className="font-medium text-sm mb-3">{t('prd.comments')}</h3>
            <div className="space-y-3 mb-3 max-h-72 overflow-y-auto">
              {comments.length === 0 ? <div className="text-sm text-slate-400 py-4 text-center">{t('prd.noCommentsYet')}</div> : comments.map(c => (
                <div key={c.id} className="text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.author_name || t('prd.unknown')}</span>
                    <span className="text-xs text-slate-400">{formatDate(c.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{c.comment}</p>
                </div>
              ))}
            </div>
            <form onSubmit={postComment} className="flex gap-2">
              <input value={comment} onChange={e => setComment(e.target.value)} placeholder={t('prd.addCommentPlaceholder')}
                className="flex-1 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
              <GlassButton disabled={posting} variant="primary">{posting ? '…' : t('prd.post')}</GlassButton>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          {isAdmin && (
            <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
              <h3 className="font-medium text-sm mb-3">{t('prd.changeStatus')}</h3>
              <Dropdown value={r.status} onChange={changeStatus} options={ALL_STATUSES.map(s => [s, trEnum(t, 'status', s)])} disabled={busy} />
              <div className="flex flex-wrap gap-1.5 mt-3">
                {STATUS_ACTIONS.filter(to => to !== r.status).map(to => (
                  <GlassButton key={to} disabled={busy} onClick={() => changeStatus(to)}
                    variant={statusActionVariant(to)} className="text-xs px-2.5 py-1.5">{t('pd.act.' + to)}</GlassButton>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
            <h3 className="font-medium text-sm mb-3">{t('prd.statusHistory')}</h3>
            {!data.statusHistory || data.statusHistory.length === 0 ? (
              <div className="text-sm text-slate-400 py-4 text-center">{t('prd.noStatusChanges')}</div>
            ) : (
              <ul className="space-y-3 text-sm">
                {data.statusHistory.map(h => (
                  <li key={h.id} className="flex gap-2">
                    <span className="h-2 w-2 rounded-full bg-brand-500 mt-1.5 shrink-0" />
                    <div>
                      <div>{h.from_status ? `${trEnum(t, 'status', h.from_status)} → ${trEnum(t, 'status', h.to_status)}` : trEnum(t, 'status', h.to_status)}</div>
                      <div className="text-xs text-slate-400">{h.changed_by_name || ''} · {formatDate(h.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </>
  );
}
