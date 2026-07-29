'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 20000;

export default function GoodsReceiptsPage() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ supplier_id: '', warehouse_id: '', receipt_date: new Date().toISOString().slice(0, 10), items: [{ product_id: '', material_id: '', qty_received: 1, unit_cost: 0 }] });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: grd, mutate } = useLiveData(`/api/goods-receipts?page=${page}&limit=50`, REFRESH_MS);
  const { data: sd } = useLiveData('/api/suppliers?limit=200', 0);
  const { data: wd } = useLiveData('/api/warehouses', 0);
  const { data: prods } = useLiveData('/api/products?limit=200', 0);
  const { data: mats } = useLiveData('/api/materials?limit=200', 0);

  const receipts = grd?.receipts || [];
  const total = grd?.total || 0;
  const suppliers = sd?.suppliers || [];
  const warehouses = wd?.warehouses || [];

  const supplierOptions = [{ value: '', label: t('suppliers.selectSupplier') }, ...suppliers.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name }))];
  const warehouseOptions = [{ value: '', label: t('warehouses.selectWarehouse') }, ...warehouses.filter(w => w.is_active).map(w => ({ value: w.id, label: w.name }))];
  const productOptions = [{ value: '', label: t('common.select') }, ...(prods?.products || []).map(p => ({ value: 'p:' + p.id, label: p.name }))];
  const materialOptions = (mats?.materials || []).map(m => ({ value: 'm:' + m.id, label: m.name }));
  const allItemOptions = [...productOptions, { value: '', label: '── Materials ──', disabled: true }, ...materialOptions];

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { product_id: '', material_id: '', qty_received: 1, unit_cost: 0 }] })); }
  function removeItem(i) { setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) })); }
  function updateItem(i, key, val) {
    setForm(f => {
      const items = [...f.items];
      if (key === 'item_ref') {
        if (val.startsWith('p:')) items[i] = { ...items[i], product_id: val.slice(2), material_id: '' };
        else if (val.startsWith('m:')) items[i] = { ...items[i], material_id: val.slice(2), product_id: '' };
        else items[i] = { ...items[i], product_id: '', material_id: '' };
      } else {
        items[i] = { ...items[i], [key]: val };
      }
      return { ...f, items };
    });
  }
  function getItemRef(item) {
    if (item.product_id) return 'p:' + item.product_id;
    if (item.material_id) return 'm:' + item.material_id;
    return '';
  }

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/goods-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.created') });
      setModal(null);
      setForm({ supplier_id: '', warehouse_id: '', receipt_date: new Date().toISOString().slice(0, 10), items: [{ product_id: '', material_id: '', qty_received: 1, unit_cost: 0 }] });
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, mutate, t]);

  return (
    <Shell active="/goods-receipts">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal('add')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('gr.addReceipt')}</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('gr.grNumber')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.suppliers')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('gr.receiptDate')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('gr.invoiceNumber')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.receivedBy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {receipts.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {receipts.map(r => (
                <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{r.gr_number || r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium">{r.inv_suppliers?.name || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.inv_warehouses?.name || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.receipt_date || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.invoice_number || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.platform_users?.full_name || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[color:var(--bd)] text-sm text-[color:var(--tx-3)]">
            <span>{t('common.showing', { from: (page - 1) * 50 + 1, to: Math.min(page * 50, total), total })}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="gbtn gbtn-ghost gbtn--sm">{t('common.prev')}</button>
              <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)} className="gbtn gbtn-ghost gbtn--sm">{t('common.next')}</button>
            </div>
          </div>
        )}
      </div>

      {modal === 'add' && (
        <GlassModal title={t('gr.addReceipt')} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('nav.suppliers')} *</label>
                <GlassSelect value={form.supplier_id} onChange={v => setForm(f => ({ ...f, supplier_id: v }))} options={supplierOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('nav.warehouses')} *</label>
                <GlassSelect value={form.warehouse_id} onChange={v => setForm(f => ({ ...f, warehouse_id: v }))} options={warehouseOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('gr.receiptDate')}</label>
                <GlassInput type="date" value={form.receipt_date || ''} onChange={v => setForm(f => ({ ...f, receipt_date: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('gr.invoiceNumber')}</label>
                <GlassInput value={form.invoice_number || ''} onChange={v => setForm(f => ({ ...f, invoice_number: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('gr.deliveryNote')}</label>
                <GlassInput value={form.delivery_note || ''} onChange={v => setForm(f => ({ ...f, delivery_note: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('gr.grNumber')}</label>
                <GlassInput value={form.gr_number || ''} onChange={v => setForm(f => ({ ...f, gr_number: v }))} placeholder="GR-2024-001" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.notes')}</label>
                <GlassTextarea value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={2} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[color:var(--tx-3)] uppercase tracking-wide">{t('pr.items')}</span>
                <button onClick={addItem} className="gbtn gbtn-ghost gbtn--sm"><GlassIcon name="plus" size={14} bare />{t('common.addItem')}</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-5">
                      <GlassSelect value={getItemRef(item)} onChange={v => updateItem(i, 'item_ref', v)} options={allItemOptions} />
                    </div>
                    <div className="col-span-3">
                      <GlassInput type="number" value={item.qty_received} onChange={v => updateItem(i, 'qty_received', v)} placeholder={t('gr.qtyReceived')} />
                    </div>
                    <div className="col-span-3">
                      <GlassInput type="number" value={item.unit_cost} onChange={v => updateItem(i, 'unit_cost', v)} placeholder={t('stock.unitCost')} />
                    </div>
                    <button onClick={() => removeItem(i)} disabled={form.items.length <= 1} className="col-span-1 gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500">
                      <GlassIcon name="x" size={14} bare />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setModal(null)} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={submit} disabled={busy || !form.supplier_id || !form.warehouse_id} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
