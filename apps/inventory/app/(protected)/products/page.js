'use client';

/* Products workspace — local inv_products with a read-only SmartLife
   fallback (2,912 real records) when the local table has no matching
   rows, same pattern as Materials. Previously fell back onto the public
   marketing website's `products` table by mistake (see api/products/
   route.js) — fixed. The separate "SmartLife Source" side-panel is gone;
   SmartLife-sourced rows now show inline, tagged read-only, instead of a
   disconnected read-only viewer next to an unrelated local list. */

import { useState, useCallback, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast, GlassButton, GlassBadge } from '@/components/glass';
import ListPagination from '@/components/Pagination';

const REFRESH_MS = 30000;

/* Business-role labels for SmartLife-sourced items. 'unclassified' is the
   default for every SmartLife record — nothing is auto-classified (see
   apps/inventory/app/api/products/classify/route.js for why). An admin
   picks the real role from evidence (purchase/sale history, QuotePro
   records) using the dropdown below; this never guesses on its own. */
const ROLE_OPTIONS = ['unclassified', 'material', 'finished_product', 'resale_product', 'hybrid', 'service'];
function roleLabels(t) {
  return Object.fromEntries(ROLE_OPTIONS.map(r => [r, t('role.' + r)]));
}

function money(v) { return v == null || Number(v) === 0 ? '—' : `SAR ${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }

function LabelModal({ product, onClose, t }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const code = product.barcode || product.sku || product.id;

  useEffect(() => {
    QRCode.toDataURL(String(code), { margin: 1, width: 160 }).then(setQrDataUrl).catch(() => {});
  }, [code]);

  return (
    <GlassModal title={t('products.printLabel')} onClose={onClose}>
      <div className="flex flex-col items-center gap-2 py-4 print-label">
        {qrDataUrl && <img src={qrDataUrl} alt="QR" width={160} height={160} className="bg-white rounded p-2" />}
        <p className="font-semibold text-center">{product.name}</p>
        <p className="text-xs text-[color:var(--tx-3)] font-mono">{code}</p>
      </div>
      <div className="flex justify-end gap-2 mt-2 print:hidden">
        <button onClick={onClose} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
        <button onClick={() => window.print()} className="gbtn gbtn-primary">{t('products.printLabel')}</button>
      </div>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-label, .print-label * { visibility: visible; }
          .print-label { position: fixed; inset: 0; }
        }
      `}</style>
    </GlassModal>
  );
}

/* Connects an operational item (classified as 'material') to an existing
   QuotePro Material — NOT the same table, a relationship (see
   apps/inventory/app/api/products/quotepro-link/route.js). Never creates
   a QuotePro Material automatically; search finds an existing one. */
function QuoteProLinkModal({ product, onClose, onLinked, setToast, t }) {
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState('');
  const [priceInput, setPriceInput] = useState(String(product.cost_price || product.selling_price || ''));

  const search = useCallback(async (query) => {
    const res = await fetch(`/api/products/quotepro-link?q=${encodeURIComponent(query)}&source_record_id=${encodeURIComponent(product.id)}`, { credentials: 'same-origin' });
    const d = await res.json().catch(() => ({}));
    setCandidates(d.candidates || []);
    setLink(d.link || null);
  }, [product.id]);

  useEffect(() => { search(''); }, [search]);

  async function connect(qtMaterialId) {
    setBusy('link');
    try {
      const res = await fetch('/api/products/quotepro-link', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ source_record_id: String(product.id), qt_material_id: qtMaterialId }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not link.');
      setToast({ kind: 'success', text: t('qp.linkedSuccess') });
      setLink(d.link);
      onLinked?.();
    } catch (e) { setToast({ kind: 'error', text: e.message }); }
    finally { setBusy(''); }
  }

  async function unlink() {
    setBusy('unlink');
    try {
      const res = await fetch(`/api/products/quotepro-link?source_record_id=${encodeURIComponent(product.id)}`, { method: 'DELETE', credentials: 'same-origin' });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not remove link.'); }
      setToast({ kind: 'success', text: t('qp.linkRemoved') });
      setLink(null);
      onLinked?.();
    } catch (e) { setToast({ kind: 'error', text: e.message }); }
    finally { setBusy(''); }
  }

  async function pushPrice() {
    const price = Number(priceInput);
    if (!Number.isFinite(price) || price < 0) { setToast({ kind: 'error', text: t('qp.enterValidPrice') }); return; }
    setBusy('price');
    try {
      const res = await fetch('/api/products/push-price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ qt_material_id: link.canonical_id, price }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Could not update QuotePro.');
      setToast({ kind: 'success', text: t('qp.priceUpdated') });
    } catch (e) { setToast({ kind: 'error', text: e.message }); }
    finally { setBusy(''); }
  }

  return (
    <GlassModal title={`${t('qp.modalTitle')} — ${product.name}`} onClose={onClose} wide>
      {link ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-[color:var(--bd)] p-3 text-sm">
            {t('qp.linkedTo')} <span className="font-mono">{link.canonical_id}</span>.
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('qp.pushPriceLabel')}</label>
              <GlassInput type="number" value={priceInput} onChange={e => setPriceInput(e.target.value)} />
            </div>
            <button onClick={pushPrice} disabled={busy === 'price'} className="gbtn gbtn-primary">{busy === 'price' ? '…' : t('qp.pushPrice')}</button>
          </div>
          <div className="text-xs text-[color:var(--tx-3)]">{t('qp.priceNote')}</div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={unlink} disabled={busy === 'unlink'} className="gbtn gbtn-ghost text-red-500">{busy === 'unlink' ? '…' : t('qp.removeLink')}</button>
            <button onClick={onClose} className="gbtn gbtn-ghost">{t('qp.close')}</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <GlassInput value={q} onChange={e => { setQ(e.target.value); search(e.target.value); }} placeholder={t('qp.searchPlaceholder')} />
          <div className="max-h-72 overflow-y-auto divide-y divide-[color:var(--bd)]">
            {candidates.length === 0 && <div className="py-6 text-center text-sm text-[color:var(--tx-3)]">{q.trim() ? t('qp.noMatch') : t('qp.typeToSearch')}</div>}
            {candidates.map(c => (
              <div key={c.id} className="flex items-center justify-between py-2 text-sm">
                <div><div className="font-medium">{c.name}</div><div className="text-xs text-[color:var(--tx-3)]">{c.code || '—'}</div></div>
                <button onClick={() => connect(c.id)} disabled={busy === 'link'} className="gbtn gbtn-ghost gbtn--sm">{busy === 'link' ? '…' : t('qp.link')}</button>
              </div>
            ))}
          </div>
          <div className="flex justify-end"><button onClick={onClose} className="gbtn gbtn-ghost">{t('qp.close')}</button></div>
        </div>
      )}
    </GlassModal>
  );
}

/* Real purchase history from live SmartLife purchase invoice line items —
   see apps/inventory/app/api/products/purchase-history/route.js. Never a
   local copy; scans the most recent invoices on demand and discloses the
   scan bound rather than silently showing a partial history as complete. */
function PurchaseHistoryModal({ product, onClose, t }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/products/purchase-history?product_id=${encodeURIComponent(product.id)}`, { credentials: 'same-origin' })
      .then(r => r.json())
      .then(d => { if (!cancelled) { if (d.error) setError(d.error); else setData(d); } })
      .catch(() => { if (!cancelled) setError('Could not load purchase history.'); });
    return () => { cancelled = true; };
  }, [product.id]);

  return (
    <GlassModal title={`${t('history.modalTitle')} — ${product.name}`} onClose={onClose} wide>
      {error && <div className="text-sm text-red-500 py-4">{error}</div>}
      {!error && !data && <div className="text-sm text-[color:var(--tx-3)] py-8 text-center">{t('history.loading')}</div>}
      {data && (
        <>
          {data.note && <div className="mb-3 text-xs text-[color:var(--tx-3)] rounded-lg border border-[color:var(--bd)] p-2">{data.note}</div>}
          {data.lines.length === 0 ? (
            <div className="text-sm text-[color:var(--tx-3)] py-8 text-center">{t('history.noResults', { n: data.scanned })}</div>
          ) : (
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-[color:var(--bd)]">
                  <th className="text-start p-2 text-xs uppercase text-[color:var(--tx-3)]">{t('history.colDate')}</th>
                  <th className="text-start p-2 text-xs uppercase text-[color:var(--tx-3)]">{t('history.colSupplier')}</th>
                  <th className="text-start p-2 text-xs uppercase text-[color:var(--tx-3)]">{t('history.colReference')}</th>
                  <th className="text-end p-2 text-xs uppercase text-[color:var(--tx-3)]">{t('history.colQty')}</th>
                  <th className="text-end p-2 text-xs uppercase text-[color:var(--tx-3)]">{t('history.colUnitCost')}</th>
                </tr></thead>
                <tbody>{data.lines.map((l, i) => (
                  <tr key={i} className="border-b border-[color:var(--bd)]">
                    <td className="p-2">{l.date || '—'}</td>
                    <td className="p-2">{l.supplier || '—'}</td>
                    <td className="p-2">{l.reference || '—'}</td>
                    <td className="p-2 text-end">{l.quantity}</td>
                    <td className="p-2 text-end">SAR {l.unit_cost.toFixed(2)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </>
      )}
      <div className="flex justify-end mt-3"><button onClick={onClose} className="gbtn gbtn-ghost">{t('qp.close')}</button></div>
    </GlassModal>
  );
}

export default function ProductsPage() {
  const { t } = useLanguage();
  const ROLE_LABELS = useMemo(() => roleLabels(t), [t]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState(null); // 'add' | 'edit' | 'view'
  const [labelProduct, setLabelProduct] = useState(null);
  const [quoteProProduct, setQuoteProProduct] = useState(null);
  const [historyProduct, setHistoryProduct] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState('');
  const [toast, setToast] = useState(null);

  const { data: pd, mutate } = useLiveData(`/api/products?search=${encodeURIComponent(search)}&page=${page}&limit=${pageSize}`, REFRESH_MS);
  const { data: cats } = useLiveData('/api/categories', 0);
  const { data: units } = useLiveData('/api/units', 0);

  const products = pd?.products || [];
  const total = pd?.total || 0;

  function openAdd() { setForm({}); setModal('add'); }
  function openEdit(p) { setForm({ ...p, category_id: p.category_id || '', unit_id: p.unit_id || '' }); setModal('edit'); }
  function openView(p) { setForm(p); setModal('view'); }
  function closeModal() { setModal(null); setForm({}); }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const isEdit = modal === 'edit';
      const res = await fetch(isEdit ? `/api/products/${form.id}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: isEdit ? t('common.updated') : t('common.created') });
      closeModal();
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }, [form, modal, mutate, t]);

  const classify = useCallback(async (p, business_role) => {
    const res = await fetch('/api/products/classify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ source_record_id: String(p.id), business_role }),
    });
    if (res.ok) { setToast({ kind: 'success', text: t('role.classifiedAs', { role: ROLE_LABELS[business_role] }) }); mutate(); }
    else { const d = await res.json().catch(() => ({})); setToast({ kind: 'error', text: d.error || t('common.saveFailed') }); }
  }, [mutate, t, ROLE_LABELS]);

  const deactivate = useCallback(async (id) => {
    if (!confirm(t('common.confirmDeactivate'))) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setToast({ kind: 'success', text: t('common.deactivated') }); mutate(); }
    else { const d = await res.json(); setToast({ kind: 'error', text: d.error }); }
  }, [mutate, t]);

  const categoryOptions = [{ value: '', label: t('common.selectCategory') }, ...(cats?.categories || []).map(c => ({ value: c.id, label: c.name }))];
  const unitOptions = [{ value: '', label: t('common.selectUnit') }, ...(units?.units || []).map(u => ({ value: u.id, label: `${u.name}${u.symbol ? ' (' + u.symbol + ')' : ''}` }))];

  const reportColumns = [
    { key: 'name', header: t('common.name') }, { key: 'sku', header: t('products.sku') },
    { key: 'category', header: t('common.category') }, { key: 'qty', header: t('stock.qtyOnHand') },
    { key: 'price', header: t('products.costPrice') },
  ];
  function toReportRow(p) {
    return {
      name: p.name || '—', sku: p.sku || '—', category: p.category_name || (p.inv_categories?.name) || '—',
      qty: Number(p.qty_on_hand || 0).toLocaleString(), price: money(p.cost_price),
    };
  }

  /* PDF must export the full filtered result set (local inv_products can be
     thousands of rows, and the SmartLife fallback alone is ~2,900 real
     products), not just the currently-displayed page. Walks every server
     page under the active search filter. */
  async function fetchAllProducts() {
    const q = new URLSearchParams({ search, page: 1, limit: 500 });
    const first = await fetch(`/api/products?${q}`, { credentials: 'same-origin' }).then(r => r.json());
    let rows = first.products || [];
    const totalRows = first.total || rows.length;
    const totalPages = Math.ceil(totalRows / 500);
    for (let p = 2; p <= totalPages; p++) {
      q.set('page', p);
      const next = await fetch(`/api/products?${q}`, { credentials: 'same-origin' }).then(r => r.json());
      rows = rows.concat(next.products || []);
    }
    return rows;
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const allProducts = await fetchAllProducts();
      const rows = allProducts.map(toReportRow);
      if (action === 'excel') {
        const res = await fetch('/api/export/xlsx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ sheetName: t('products.title') || 'Products', columns: reportColumns, rows, filename: 'products-report.xlsx' }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not generate Excel export.'); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'products-report.xlsx'; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({ title: t('products.title') || 'Products', columns: reportColumns, rows, fileName: 'products-report.pdf', action });
    } catch (e) { setToast({ kind: 'error', text: e.message || 'Could not generate report.' }); }
    finally { setReportBusy(''); }
  }

  async function runSingleReport(p, action) {
    setReportBusy(action + p.id);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: `${t('products.title') || 'Product'} — ${p.name}`,
        columns: reportColumns,
        rows: [{ name: p.name || '—', sku: p.sku || '—', category: p.category_name || (p.inv_categories?.name) || '—', qty: Number(p.qty_on_hand || 0).toLocaleString(), price: money(p.cost_price) }],
        fileName: `product-${p.sku || p.id}.pdf`, action,
      });
    } catch (e) { setToast({ kind: 'error', text: e.message || 'Could not generate report.' }); }
    finally { setReportBusy(''); }
  }

  return (
    <Shell active="/products">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('products.searchPlaceholder')} className="ginput" />
        </div>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!products.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('materials.print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!products.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('materials.downloadPdf')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('excel')} disabled={!products.length || !!reportBusy}>{reportBusy === 'excel' ? '…' : 'Download Excel'}</GlassButton>
          <button onClick={openAdd} className="gbtn gbtn-primary">
            <GlassIcon name="plus" size={16} bare />{t('products.addProduct')}
          </button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="gtable text-sm">
            <thead>
              <tr>
                <th className="text-start">{t('common.name')}</th>
                <th className="text-start">{t('products.sku')}</th>
                <th className="text-start">{t('common.category')}</th>
                <th className="text-end">{t('stock.qtyOnHand')}</th>
                <th className="text-end">{t('products.costPrice')}</th>
                <th className="text-center">{t('common.status')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>
              )}
              {products.map(p => (
                <tr key={p.id} className="cursor-pointer" onClick={() => (p.read_only ? openView(p) : openEdit(p))}>
                  <td className="font-medium max-w-[280px]">
                    <span className="block truncate" title={p.name}>{p.name}</span>
                    {p.read_only && (
                      <GlassBadge tone={p.business_role === 'unclassified' ? 'amber' : 'cyan'} className="ms-2" title={t('sl.readOnlySource')}>
                        {ROLE_LABELS[p.business_role] || p.business_role}
                      </GlassBadge>
                    )}
                  </td>
                  <td className="text-[color:var(--tx-3)]">{p.sku || '—'}</td>
                  <td className="text-[color:var(--tx-3)]">{p.category_name || p.inv_categories?.name || '—'}</td>
                  <td className="text-end font-semibold tabular-nums">{Number(p.qty_on_hand || 0).toLocaleString()} <span className="text-[color:var(--tx-3)] font-normal text-xs">{p.unit_name || p.inv_units?.symbol || ''}</span></td>
                  <td className="text-end tabular-nums">{money(p.cost_price)}</td>
                  <td className="text-center">
                    <GlassBadge tone={p.is_active ? 'emerald' : 'slate'}>
                      {p.is_active ? t('common.active') : t('common.inactive')}
                    </GlassBadge>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => runSingleReport(p, 'print')} className="gbtn gbtn-ghost gbtn--sm" disabled={!!reportBusy}>{t('materials.print')}</button>
                      <button onClick={() => runSingleReport(p, 'save')} className="gbtn gbtn-ghost gbtn--sm" disabled={!!reportBusy}>{t('materials.downloadPdf')}</button>
                      <button onClick={() => setLabelProduct(p)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm" title={t('products.printLabel')}><GlassIcon name="receipt" size={15} bare /></button>
                      {p.read_only ? (
                        <>
                          <select value={p.business_role} onChange={e => classify(p, e.target.value)} className="ginput text-xs py-1" title={t('role.classifyTooltip')}>
                            {ROLE_OPTIONS.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                          {p.business_role === 'material' && (
                            <>
                              <button onClick={() => setHistoryProduct(p)} className="gbtn gbtn-ghost gbtn--sm" title={t('history.tooltip')}>{t('history.button')}</button>
                              <button onClick={() => setQuoteProProduct(p)} className="gbtn gbtn-ghost gbtn--sm" title={t('qp.connect')}>
                                {p.quotepro_material_id ? t('qp.linked') : t('qp.unlinked')}
                              </button>
                            </>
                          )}
                          <button onClick={() => openView(p)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="eye" size={15} bare /></button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => openEdit(p)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm" title={t('common.edit')}><GlassIcon name="edit" size={15} bare /></button>
                          {p.is_active && <button onClick={() => deactivate(p.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500" title={t('common.deactivate')}><GlassIcon name="trash" size={15} bare /></button>}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ListPagination page={page} pageSize={pageSize} total={total}
          onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} t={t} />
      </div>

      {(modal === 'add' || modal === 'edit') && (
        <GlassModal title={modal === 'add' ? t('products.addProduct') : t('products.editProduct')} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder={t('products.namePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('products.sku')}</label>
              <GlassInput value={form.sku || ''} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="SKU-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('products.barcode')}</label>
              <GlassInput value={form.barcode || ''} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.category')}</label>
              <GlassSelect value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))} options={categoryOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.unit')}</label>
              <GlassSelect value={form.unit_id || ''} onChange={e => setForm(f => ({ ...f, unit_id: e.target.value }))} options={unitOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('products.costPrice')}</label>
              <GlassInput type="number" value={form.cost_price || ''} onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('products.sellingPrice')}</label>
              <GlassInput type="number" value={form.selling_price || ''} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('stock.minQty')}</label>
              <GlassInput type="number" value={form.min_stock_qty || ''} onChange={e => setForm(f => ({ ...f, min_stock_qty: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('stock.maxQty')}</label>
              <GlassInput type="number" value={form.max_stock_qty || ''} onChange={e => setForm(f => ({ ...f, max_stock_qty: e.target.value }))} placeholder="" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.description')}</label>
              <GlassTextarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={closeModal} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={save} disabled={busy || !form.name} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}

      {modal === 'view' && (
        <GlassModal title={`${t('products.title') || 'Product'} — ${form.name || ''}`} onClose={closeModal}
          footer={<div className="flex justify-end gap-2">
            <button onClick={() => runSingleReport(form, 'print')} className="gbtn gbtn-ghost">{t('materials.print')}</button>
            <button onClick={() => runSingleReport(form, 'save')} className="gbtn gbtn-ghost">{t('materials.downloadPdf')}</button>
            <button onClick={closeModal} className="gbtn gbtn-primary">{t('common.cancel')}</button>
          </div>}>
          <div className="mb-3 text-xs text-[color:var(--tx-3)]">{t('sl.readOnlySource')}</div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div><dt className="text-[color:var(--tx-3)] text-xs">{t('products.sku')}</dt><dd>{form.sku || '—'}</dd></div>
            <div><dt className="text-[color:var(--tx-3)] text-xs">{t('common.category')}</dt><dd>{form.category_name || '—'}</dd></div>
            <div><dt className="text-[color:var(--tx-3)] text-xs">{t('common.unit')}</dt><dd>{form.unit_name || '—'}</dd></div>
            <div><dt className="text-[color:var(--tx-3)] text-xs">{t('stock.qtyOnHand')}</dt><dd>{Number(form.qty_on_hand || 0).toLocaleString()}</dd></div>
            <div><dt className="text-[color:var(--tx-3)] text-xs">{t('products.costPrice')}</dt><dd>{money(form.cost_price)}</dd></div>
            <div><dt className="text-[color:var(--tx-3)] text-xs">{t('products.sellingPrice')}</dt><dd>{money(form.selling_price)}</dd></div>
          </dl>
        </GlassModal>
      )}

      {labelProduct && <LabelModal product={labelProduct} onClose={() => setLabelProduct(null)} t={t} />}
      {quoteProProduct && (
        <QuoteProLinkModal product={quoteProProduct} onClose={() => setQuoteProProduct(null)} onLinked={mutate} setToast={setToast} t={t} />
      )}
      {historyProduct && <PurchaseHistoryModal product={historyProduct} onClose={() => setHistoryProduct(null)} t={t} />}
    </Shell>
  );
}
