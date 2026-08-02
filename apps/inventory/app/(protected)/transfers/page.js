'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 20000;

export default function TransfersPage() {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ from_warehouse_id: '', to_warehouse_id: '', transfer_date: new Date().toISOString().slice(0, 10), items: [{ product_id: '', material_id: '', qty: 1 }] });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: td, mutate } = useLiveData(`/api/transfers?page=${page}&limit=50`, REFRESH_MS);
  const { data: wd } = useLiveData('/api/warehouses', 0);
  const { data: prods } = useLiveData('/api/products?limit=200', 0);
  const { data: mats } = useLiveData('/api/materials?limit=200', 0);

  const transfers = td?.transfers || [];
  const total = td?.total || 0;
  const warehouses = wd?.warehouses || [];

  const warehouseOptions = [{ value: '', label: t('warehouses.selectWarehouse') }, ...warehouses.filter(w => w.is_active).map(w => ({ value: w.id, label: w.name }))];
  const productOptions = [{ value: '', label: t('common.select') }, ...(prods?.products || []).map(p => ({ value: 'p:' + p.id, label: p.name }))];
  const materialOptions = (mats?.materials || []).map(m => ({ value: 'm:' + m.id, label: m.name }));
  const allItemOptions = [...productOptions, { value: '', label: '── Materials ──', disabled: true }, ...materialOptions];

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { product_id: '', material_id: '', qty: 1 }] })); }
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
      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.created') });
      setModal(null);
      setForm({ from_warehouse_id: '', to_warehouse_id: '', transfer_date: new Date().toISOString().slice(0, 10), items: [{ product_id: '', material_id: '', qty: 1 }] });
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, mutate, t]);

  return (
    <Shell active="/transfers">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex justify-end mb-4">
        <button onClick={() => setModal('add')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('transfer.addTransfer')}</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('transfer.transferNumber')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('transfer.from')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('transfer.to')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('transfer.transferDate')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.receivedBy')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {transfers.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {transfers.map(r => (
                <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{r.transfer_number || r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.from?.name || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.to?.name || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.transfer_date || '—'}</td>
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
        <GlassModal title={t('transfer.addTransfer')} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('transfer.from')} *</label>
                <GlassSelect value={form.from_warehouse_id} onChange={v => setForm(f => ({ ...f, from_warehouse_id: v }))} options={warehouseOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('transfer.to')} *</label>
                <GlassSelect value={form.to_warehouse_id} onChange={v => setForm(f => ({ ...f, to_warehouse_id: v }))} options={warehouseOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('transfer.transferDate')}</label>
                <GlassInput type="date" value={form.transfer_date || ''} onChange={v => setForm(f => ({ ...f, transfer_date: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('transfer.transferNumber')}</label>
                <GlassInput value={form.transfer_number || ''} onChange={v => setForm(f => ({ ...f, transfer_number: v }))} placeholder="TRF-2024-001" />
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
                    <div className="col-span-8">
                      <GlassSelect value={getItemRef(item)} onChange={v => updateItem(i, 'item_ref', v)} options={allItemOptions} />
                    </div>
                    <div className="col-span-3">
                      <GlassInput type="number" value={item.qty} onChange={v => updateItem(i, 'qty', v)} placeholder={t('transfer.qty')} />
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
            <button onClick={submit} disabled={busy || !form.from_warehouse_id || !form.to_warehouse_id} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
