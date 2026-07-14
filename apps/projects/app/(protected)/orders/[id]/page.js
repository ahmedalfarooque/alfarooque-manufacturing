'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage, trEnum } from '@/lib/i18n';
import { STATUS_BADGE } from '../page';
import { Button, Input, Textarea, Select, Field } from '@/components/ui';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed', 'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed', 'cancelled', 'returned', 'rejected'];
const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'];
function money(n) { return 'SAR ' + Number(n || 0).toLocaleString('en-US'); }
function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export default function OrderDetailPage() {
  const { id } = useParams();
  const { t, lang } = useLanguage();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [trackingPct, setTrackingPct] = useState(0);

  const load = useCallback(() => {
    fetch('/api/orders/' + id, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        setOrder(d.order);
        setStatus(d.order.status);
        setPaymentStatus(d.order.payment_status || 'pending');
        setNotes(d.order.admin_notes || '');
        setTrackingPct(d.order.tracking_pct || 0);
      })
      .catch(() => setError(t('common.genericError')));
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy(true);
    const res = await fetch('/api/orders/' + id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ status, payment_status: paymentStatus, admin_notes: notes, tracking_pct: trackingPct }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { alert(t('oq.saved')); load(); } else alert(t('common.genericError'));
  }

  async function deleteOrder() {
    if (!confirm(t('oq.confirmDeleteOrder'))) return;
    setBusy(true);
    const res = await fetch('/api/orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action: 'delete', id }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) window.location.href = '/orders';
  }

  if (error) return <Shell active="/orders"><div className="text-red-500">{error}</div></Shell>;
  if (!order) return <Shell active="/orders"><div className="text-[#8C8A80]">{t('common.loading')}</div></Shell>;

  const name = order.guest_name || order.customer_name || '—';
  const email = order.guest_email || order.customer_email || '—';

  return (
    <Shell active="/orders">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-lg font-semibold" dir="ltr">{order.order_no || order.id.slice(0, 8)}</h2>
          </div>
          <span className={'px-2 py-1 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[order.status] || '')}>{trEnum(t, 'status', order.status)}</span>
        </div>

        <div className="glass-card p-4 space-y-2 text-sm">
          <div className="font-medium text-[#8C8A80] text-xs mb-1">{t('oq.customerInfo')}</div>
          <div className="flex justify-between"><span className="text-[#8C8A80]">{t('oq.col.customer')}</span><span>{name}</span></div>
          <div className="flex justify-between"><span className="text-[#8C8A80]">{t('oq.col.email')}</span><span dir="ltr">{email}</span></div>
          <div className="flex justify-between"><span className="text-[#8C8A80]">{t('oq.col.total')}</span><span dir="ltr">{money(order.grand_total)}</span></div>
          {order.delivery_address && <div className="flex justify-between"><span className="text-[#8C8A80]">{t('oq.deliveryAddress')}</span><span className="max-w-[60%] text-end">{order.delivery_address}</span></div>}
        </div>

        {Array.isArray(order.items) && order.items.length > 0 && (
          <div className="glass-card p-4 text-sm">
            <div className="font-medium text-[#8C8A80] text-xs mb-2">{t('oq.items')}</div>
            {order.items.map((it, i) => (
              <div key={i} className="flex justify-between py-1 border-b last:border-0 border-[#E5E2DD]/70 dark:border-white/[0.06]">
                <span>{(lang === 'ar' && (it.product?.name_ar || it.name_ar)) || it.name} × {it.qty}</span><span dir="ltr">{money(it.price * it.qty)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="glass-card p-4 space-y-3 text-sm">
          <Field label={t('oq.col.status')}>
            <Select value={status} onChange={e => setStatus(e.target.value)}
              options={ORDER_STATUSES.map(s => ({ value: s, label: trEnum(t, 'status', s) }))} />
          </Field>
          <Field label={t('oq.paymentStatus')}>
            <Select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}
              options={PAYMENT_STATUSES.map(s => ({ value: s, label: trEnum(t, 'status', s) }))} />
          </Field>
          <Field label={t('oq.trackingPct')}>
            <Input type="number" min="0" max="100" value={trackingPct} onChange={e => setTrackingPct(Number(e.target.value))} />
          </Field>
          <Field label={t('oq.adminNotes')}>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
          </Field>
        </div>

        <div className="glass-card p-4 flex flex-wrap items-center gap-2">
          <Button disabled={busy} onClick={save}>{t('oq.save')}</Button>
          <Button variant="danger" disabled={busy} onClick={deleteOrder}>{t('oq.delete')}</Button>
          <a href="/orders" className="text-sm text-[#8C8A80] hover:underline ms-auto">‹ {t('oq.ordersTitle')}</a>
        </div>
      </div>
    </Shell>
  );
}
