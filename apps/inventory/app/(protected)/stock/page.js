'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 20000;

export default function StockPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [warehouseId, setWarehouseId] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const params = new URLSearchParams({ search, type, page, limit: 50 });
  if (warehouseId) params.set('warehouse_id', warehouseId);
  const { data: sd, mutate } = useLiveData(`/api/stock?${params}`, REFRESH_MS);
  const { data: wd } = useLiveData('/api/warehouses', 0);

  const stock = sd?.stock || [];
  const total = sd?.total || 0;
  const warehouses = wd?.warehouses || [];
  const whOptions = [{ value: '', label: t('common.allWarehouses') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
  const whFormOptions = [{ value: '', label: t('warehouses.selectWarehouse') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
  const typeOptions = [
    { value: 'all', label: t('common.all') },
    { value: 'product', label: t('nav.products') },
    { value: 'material', label: t('nav.materials') },
  ];

  function openAdjust(row) {
    setForm({
      warehouse_id: row.warehouse_id,
      product_id: row.product_id || null,
      material_id: row.material_id || null,
      name: row.inv_products?.name || row.inv_materials?.name || '—',
      current_qty: row.qty_on_hand,
      qty_adjustment: '',
    });
    setModal('adjust');
  }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('stock.adjusted') });
      setModal(null); setForm({}); mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, mutate, t]);

  return (
    <Shell active="/stock">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('stock.searchPlaceholder')} className="ginput flex-1 max-w-xs" />
        <GlassSelect value={type} onChange={v => { setType(v); setPage(1); }} options={typeOptions} />
        <GlassSelect value={warehouseId} onChange={v => { setWarehouseId(v); setPage(1); }} options={whOptions} />
        <div className="ms-auto text-sm text-[color:var(--tx-3)]">{t('common.total')}: {total}</div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.code')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.locations')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.qtyOnHand')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.qtyReserved')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.avgCost')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {stock.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {stock.map(row => {
                const name = row.inv_products?.name || row.inv_materials?.name || '—';
                const code = row.inv_products?.sku || row.inv_materials?.material_code || '—';
                const qty = Number(row.qty_on_hand || 0);
                return (
                  <tr key={row.id} className={'hover:bg-[color:var(--pr-soft)] transition-colors' + (qty <= 0 ? ' opacity-60' : '')}>
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{code}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{row.inv_warehouses?.name || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{row.inv_locations?.name || '—'}</td>
                    <td className={'px-4 py-3 text-end font-semibold ' + (qty <= 0 ? 'text-red-500' : qty <= 5 ? 'text-amber-500' : '')}>{qty.toLocaleString()}</td>
                    <td className="px-4 py-3 text-end text-[color:var(--tx-3)]">{Number(row.qty_reserved || 0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-end">SAR {Number(row.avg_cost || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => openAdjust(row)} className="gbtn gbtn-ghost gbtn--sm" title={t('stock.adjust')}>
                        <GlassIcon name="edit" size={14} bare />{t('stock.adjust')}
                      </button>
                    </td>
                  </tr>
                );
              })}
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

      {modal === 'adjust' && (
        <GlassModal title={t('stock.adjustStock')} onClose={() => { setModal(null); setForm({}); }}>
          <div className="space-y-4">
            <div className="glass-card glass-card--pad">
              <div className="text-sm font-medium">{form.name}</div>
              <div className="text-xs text-[color:var(--tx-3)] mt-1">{t('stock.currentStock')}: <strong>{Number(form.current_qty || 0).toLocaleString()}</strong></div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('stock.adjustment')} * <span className="text-[color:var(--tx-3)]">({t('stock.useNegative')})</span></label>
              <GlassInput type="number" value={form.qty_adjustment} onChange={v => setForm(f => ({ ...f, qty_adjustment: v }))} placeholder="+10 or -5" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('stock.unitCost')}</label>
              <GlassInput type="number" value={form.cost || ''} onChange={v => setForm(f => ({ ...f, cost: v }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.reference')}</label>
              <GlassInput value={form.reference || ''} onChange={v => setForm(f => ({ ...f, reference: v }))} placeholder="REF-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.notes')}</label>
              <GlassTextarea value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setModal(null); setForm({}); }} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={save} disabled={busy || !form.qty_adjustment} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('stock.applyAdjustment')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
