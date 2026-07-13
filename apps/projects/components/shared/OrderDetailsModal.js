'use client';

/* Read-only Order View — mirrors the Website Admin's openOrderView()
   modal (js/admin/dashboard.js) field-for-field: same product cards
   (thumbnail + gallery + specs), same Customer/Order Info/Timeline/
   Totals sections, same data (both apps enrich order items against the
   identical public.products/public.categories tables — see
   apps/projects/lib/orderEnrich.js and api/_orderEnrich.js on the main
   site). This is a genuinely separate React component, not a literal
   shared file — the Website Admin is a plain static site rendering via
   innerHTML string templates, not a Next.js app, so the two runtimes
   can't import the same component. Any change to what DATA the order
   carries flows into both automatically; a layout change made only to
   the Website Admin's modal still needs the same edit made here. */

import { useEffect, useState } from 'react';
import { useLanguage, trEnum } from '@/lib/i18n';

const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'manufacturing', 'quality_check', 'packed', 'ready', 'shipped', 'out_for_delivery', 'delivered', 'completed'];
const CANCELLED_STATUSES = ['cancelled', 'returned', 'rejected'];
export const STATUS_BADGE = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  confirmed: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  processing: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400',
  rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  returned: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
function label(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }
function money(n) { return 'SAR ' + Number(n || 0).toLocaleString('en-US'); }

/* If a resolved image URL genuinely 404s (file deleted, legacy/bad
   path, etc.), fall back to the same empty-placeholder box used when
   there's no image at all — never a broken-image icon, and the error
   is swallowed here so it never reaches the console. */
function ImgWithFallback({ src, className }) {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return <div className={className + ' flex items-center justify-center text-slate-400 text-xs'}>—</div>;
  return <img src={src} alt="" className={className + ' object-cover'} loading="lazy" onError={() => setFailed(true)} />;
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b last:border-0 border-black/5 dark:border-white/5 text-sm">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-end min-w-0 break-words">{value === null || value === undefined || value === '' ? '—' : value}</span>
    </div>
  );
}

function ItemCard({ item, t, lang, onImageClick }) {
  const p = item.product || null;
  const images = (p && Array.isArray(p.images) ? p.images : []);
  const qty = Number(item.qty) || 1;
  const unit = item.price != null ? Number(item.price) : 0;
  const total = unit * qty;
  const spec = (lbl, val) => val ? (
    <div className="flex justify-between text-xs py-0.5"><span className="text-slate-400">{lbl}</span><span>{val}</span></div>
  ) : null;
  /* Display follows the CURRENT UI language, not the language the order/
     product was originally entered in — Arabic product fields ride along
     on p (see lib/orderEnrich.js); fall back to the base field when no
     translation is stored. */
  const ar = lang === 'ar';
  const prodName = ar ? ((p && p.name_ar) || item.name || (p && p.name)) : (item.name || (p && p.name));
  const prodDesc = p ? (ar ? (p.description_ar || p.description) : p.description) : null;
  const prodCategory = p ? (ar ? (p.category_ar || p.category) : p.category) : null;
  const prodSizes = p ? (ar && p.sizes_ar?.length ? p.sizes_ar : p.sizes) : [];
  const prodFinishes = p ? (ar && p.finishes_ar?.length ? p.finishes_ar : p.finishes) : [];

  return (
    <div className="flex gap-3 rounded-lg border border-black/5 dark:border-white/10 p-3">
      <div className="shrink-0">
        {images.length ? (
          <button type="button" onClick={() => onImageClick(images, 0)} className="block w-16 h-16 rounded-lg overflow-hidden border border-black/10 dark:border-white/10">
            <ImgWithFallback src={images[0]} className="w-full h-full" />
          </button>
        ) : (
          <div className="w-16 h-16 rounded-lg border border-black/10 dark:border-white/10 flex items-center justify-center text-slate-400 text-xs">—</div>
        )}
        {images.length > 1 && (
          <div className="flex gap-1 mt-1">
            {images.slice(1, 4).map((src, i) => (
              <button key={i} type="button" onClick={() => onImageClick(images, i + 1)} className="w-4 h-4 rounded overflow-hidden border border-black/10 dark:border-white/10">
                <ImgWithFallback src={src} className="w-full h-full" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{prodName || t('oq.item')}</div>
        {prodDesc && <div className="text-xs text-slate-400 line-clamp-2 mt-0.5">{prodDesc}</div>}
        <div className="mt-1">
          {spec(t('oq.specCategory'), prodCategory)}
          {spec(t('oq.specSku'), p?.sku)}
          {spec(t('oq.specMaterial'), item.material || p?.material)}
          {spec(t('oq.specSize'), item.size || (prodSizes?.length ? prodSizes.join(' / ') : null))}
          {spec(t('oq.specColor'), item.color)}
          {spec(t('oq.specFinish'), item.finish || (prodFinishes?.length ? prodFinishes.join(' / ') : null))}
          {spec(t('oq.specQuantity'), '× ' + qty)}
          {spec(t('oq.unitPrice'), money(unit))}
        </div>
      </div>
      <div className="shrink-0 text-sm font-semibold self-center" dir="ltr">{money(total)}</div>
    </div>
  );
}

export default function OrderDetailsModal({ orderId, onClose }) {
  const { t, lang, formatDate } = useLanguage();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { images, idx }

  useEffect(() => {
    if (!orderId) return;
    setOrder(null);
    setError(null);
    fetch('/api/orders/' + orderId, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setOrder(d.order))
      .catch(() => setError(t('common.genericError')));
  }, [orderId, t]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { if (lightbox) setLightbox(null); else onClose(); } }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox, onClose]);

  if (!orderId) return null;

  const items = order?.items || [];
  const custName = order ? (order.guest_name || order.customer_name || (order.user_id ? t('oq.customerInfo') : t('oq.customerInfo'))) : '';
  const statusIdx = order ? ORDER_STATUSES.indexOf(order.status) : -1;
  const cancelled = order ? CANCELLED_STATUSES.includes(order.status) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:p-8" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0f172a] border border-black/5 dark:border-white/10 shadow-2xl my-8">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-black/5 dark:border-white/10 bg-white dark:bg-[#0f172a] rounded-t-2xl">
          <h3 className="font-semibold text-base flex items-center gap-2 flex-wrap">
            {order && (
              <>
                <span dir="ltr">{order.order_no || order.id.slice(0, 8)}</span>
                <span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[order.status] || '')}>{trEnum(t, 'status', order.status)}</span>
                <span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[order.payment_status] || 'bg-amber-500/10 text-amber-600')}>{trEnum(t, 'status', order.payment_status || 'pending')}</span>
              </>
            )}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xl leading-none">&times;</button>
        </div>

        <div className="p-5 space-y-5">
          {error && <div className="text-red-500 text-sm">{error}</div>}
          {!order && !error && <div className="text-slate-400 text-sm">{t('common.loading')}</div>}

          {order && (
            <>
              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">{t('oq.productsCount', { n: items.length })}</div>
                {items.length ? (
                  <div className="space-y-2">{items.map((it, i) => <ItemCard key={i} item={it} t={t} lang={lang} onImageClick={(imgs, idx) => setLightbox({ images: imgs, idx })} />)}</div>
                ) : (
                  <p className="text-slate-400 text-sm">{t('oq.noItemDetails')}</p>
                )}
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">{t('oq.customerInfo')}</div>
                <div className="rounded-lg border border-black/5 dark:border-white/10 px-3">
                  <Row label={t('oq.name')} value={custName} />
                  <Row label={t('common.email')} value={<span dir="ltr">{order.guest_email || order.customer_email || ''}</span>} />
                  <Row label={t('oq.phone')} value={<span dir="ltr">{order.guest_phone || ''}</span>} />
                  <Row label={t('oq.company')} value={order.guest_company} />
                  <Row label={t('oq.deliveryAddress')} value={order.delivery_address} />
                </div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">{t('oq.orderInfo')}</div>
                <div className="rounded-lg border border-black/5 dark:border-white/10 px-3">
                  <Row label={t('oq.col.orderNo')} value={<span dir="ltr">{order.order_no || order.id}</span>} />
                  <Row label={t('oq.col.date')} value={formatDate(order.created_at, { dateStyle: 'medium', timeStyle: 'short' })} />
                  <Row label={t('oq.col.status')} value={<span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[order.status] || '')}>{trEnum(t, 'status', order.status)}</span>} />
                  <Row label={t('oq.paymentStatus')} value={<span className={'px-2 py-0.5 rounded-full text-xs font-medium capitalize ' + (STATUS_BADGE[order.payment_status] || 'bg-amber-500/10 text-amber-600')}>{trEnum(t, 'status', order.payment_status || 'pending')}</span>} />
                  <Row label={t('oq.currentStage')} value={order.current_stage} />
                  <Row label={t('oq.tracking')} value={(order.tracking_pct || 0) + '%'} />
                  <Row label={t('oq.estCompletion')} value={order.estimated_completion} />
                  <Row label={t('oq.estDelivery')} value={order.estimated_delivery} />
                  <Row label={t('oq.trackingNumber')} value={<span dir="ltr">{order.tracking_number || ''}</span>} />
                  <Row label={t('oq.courier')} value={order.courier} />
                  <Row label={t('oq.adminNotes')} value={order.admin_notes} />
                </div>
              </div>

              {!cancelled && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {ORDER_STATUSES.map(s => {
                    const done = ORDER_STATUSES.indexOf(s) <= statusIdx && statusIdx !== -1;
                    return (
                      <div key={s} className="flex flex-col items-center gap-1 shrink-0 w-16">
                        <div className={'w-5 h-5 rounded-full flex items-center justify-center text-[10px] ' + (done ? 'bg-brand-600 text-white' : 'bg-black/10 dark:bg-white/10 text-slate-400')}>
                          {done ? '✓' : ''}
                        </div>
                        <div className="text-[10px] text-center text-slate-400 capitalize leading-tight">{trEnum(t, 'status', s)}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-slate-400 mb-2">{t('oq.totals')}</div>
                <div className="rounded-lg border border-black/5 dark:border-white/10 px-3">
                  <Row label={t('oq.subtotal')} value={<span dir="ltr">{money(order.subtotal)}</span>} />
                  <Row label={t('oq.vat')} value={<span dir="ltr">{money(order.vat)}</span>} />
                  <Row label={t('oq.shipping')} value={order.shipping_cost != null ? <span dir="ltr">{money(order.shipping_cost)}</span> : null} />
                  <Row label={t('oq.discount')} value={order.discount != null ? <span dir="ltr">{money(order.discount)}</span> : null} />
                  <Row label={<strong>{t('oq.grandTotal')}</strong>} value={<strong dir="ltr" className="text-brand-600">{money(order.grand_total)}</strong>} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
          <img src={lightbox.images[lightbox.idx]} alt="" className="max-w-full max-h-full rounded-lg" onClick={e => e.stopPropagation()}
            onError={() => setLightbox(null)} />
          {lightbox.images.length > 1 && (
            <>
              <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: (l.idx - 1 + l.images.length) % l.images.length })); }}
                className="absolute start-4 top-1/2 -translate-y-1/2 text-white text-3xl px-2">‹</button>
              <button onClick={e => { e.stopPropagation(); setLightbox(l => ({ ...l, idx: (l.idx + 1) % l.images.length })); }}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-white text-3xl px-2">›</button>
            </>
          )}
          <button onClick={() => setLightbox(null)} className="absolute top-4 end-4 text-white text-2xl">&times;</button>
        </div>
      )}
    </div>
  );
}
