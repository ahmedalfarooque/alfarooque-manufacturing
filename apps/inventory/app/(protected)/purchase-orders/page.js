'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage, trEnum } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 20000;
const STATUS_COLORS = { pending: 'text-amber-500 bg-amber-500/10', ordered: 'text-blue-500 bg-blue-500/10', partial: 'text-orange-500 bg-orange-500/10', received: 'text-emerald-500 bg-emerald-500/10', cancelled: 'text-red-500 bg-red-500/10' };

export default function PurchaseOrdersPage() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ supplier_id: '', currency: 'SAR', items: [{ product_id: '', material_id: '', description: '', qty_ordered: 1, unit_cost: 0 }] });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const params = new URLSearchParams({ page, limit: 50 });
  if (statusFilter) params.set('status', statusFilter);
  const { data: pod, mutate } = useLiveData(`/api/purchase-orders?${params}`, REFRESH_MS);
  const { data: sd } = useLiveData('/api/suppliers?limit=200', 0);
  const { data: prods } = useLiveData('/api/products?limit=200', 0);
  const { data: mats } = useLiveData('/api/materials?limit=200', 0);

  const orders = pod?.orders || [];
  const total = pod?.total || 0;
  const suppliers = sd?.suppliers || [];

  const statusOptions = [
    { value: '', label: t('common.allStatuses') },
    ...['pending', 'ordered', 'partial', 'received', 'cancelled'].map(v => ({ value: v, label: trEnum(t, 'poStatus', v) })),
  ];
  const supplierOptions = [{ value: '', label: t('suppliers.selectSupplier') }, ...suppliers.filter(s => s.is_active).map(s => ({ value: s.id, label: s.name }))];
  const productOptions = [{ value: '', label: t('common.select') }, ...(prods?.products || []).map(p => ({ value: 'p:' + p.id, label: p.name }))];
  const materialOptions = (mats?.materials || []).map(m => ({ value: 'm:' + m.id, label: m.name }));
  const allItemOptions = [...productOptions, { value: '', label: '── Materials ──', disabled: true }, ...materialOptions];

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { product_id: '', material_id: '', description: '', qty_ordered: 1, unit_cost: 0 }] })); }
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

  const totalAmount = (form.items || []).reduce((s, it) => s + (Number(it.qty_ordered) || 0) * (Number(it.unit_cost) || 0), 0);

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.created') });
      setModal(null);
      setForm({ supplier_id: '', currency: 'SAR', items: [{ product_id: '', material_id: '', description: '', qty_ordered: 1, unit_cost: 0 }] });
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, mutate, t]);

  const doAction = useCallback(async (id, act) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: act }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ kind: 'success', text: t('common.updated') });
      setModal(null); setSelected(null); mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [mutate, t]);

  return (
    <Shell active="/purchase-orders">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <GlassSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={statusOptions} />
        <button onClick={() => setModal('add')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('po.addOrder')}</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.number')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.suppliers')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.amount')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('po.expectedDelivery')}</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.date')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {orders.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {orders.map(o => (
                <tr key={o.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{o.po_number || o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium">{o.inv_suppliers?.name || '—'}</td>
                  <td className="px-4 py-3 text-end font-semibold">SAR {Number(o.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{o.expected_delivery || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_COLORS[o.status] || '')}>
                      {trEnum(t, 'poStatus', o.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{o.created_at ? new Date(o.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    {o.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => doAction(o.id, 'send')} className="gbtn gbtn-ghost gbtn--sm text-blue-500">{t('po.sendOrder')}</button>
                        <button onClick={() => doAction(o.id, 'cancel')} className="gbtn gbtn-ghost gbtn--sm text-red-500">{t('common.cancel')}</button>
                      </div>
                    )}
                  </td>
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
        <GlassModal title={t('po.addOrder')} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('nav.suppliers')} *</label>
                <GlassSelect value={form.supplier_id} onChange={v => setForm(f => ({ ...f, supplier_id: v }))} options={supplierOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('po.expectedDelivery')}</label>
                <GlassInput type="date" value={form.expected_delivery || ''} onChange={v => setForm(f => ({ ...f, expected_delivery: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.currency')}</label>
                <GlassSelect value={form.currency} onChange={v => setForm(f => ({ ...f, currency: v }))} options={[{ value: 'SAR', label: 'SAR' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} />
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
                    <div className="col-span-4">
                      <GlassSelect value={getItemRef(item)} onChange={v => updateItem(i, 'item_ref', v)} options={allItemOptions} />
                    </div>
                    <div className="col-span-3">
                      <GlassInput value={item.description || ''} onChange={v => updateItem(i, 'description', v)} placeholder={t('common.description')} />
                    </div>
                    <div className="col-span-2">
                      <GlassInput type="number" value={item.qty_ordered} onChange={v => updateItem(i, 'qty_ordered', v)} placeholder={t('common.qty')} />
                    </div>
                    <div className="col-span-2">
                      <GlassInput type="number" value={item.unit_cost} onChange={v => updateItem(i, 'unit_cost', v)} placeholder={t('stock.unitCost')} />
                    </div>
                    <button onClick={() => removeItem(i)} disabled={form.items.length <= 1} className="col-span-1 gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500">
                      <GlassIcon name="x" size={14} bare />
                    </button>
                  </div>
                ))}
              </div>
              <div className="text-end text-sm font-semibold mt-2">{t('common.total')}: {form.currency} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setModal(null)} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={submit} disabled={busy || !form.supplier_id} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
