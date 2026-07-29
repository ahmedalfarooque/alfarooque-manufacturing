'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 30000;

export default function MaterialsPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: md, mutate } = useLiveData(`/api/materials?search=${encodeURIComponent(search)}&page=${page}&limit=50`, REFRESH_MS);
  const { data: cats } = useLiveData('/api/categories', 0);
  const { data: units } = useLiveData('/api/units', 0);

  const materials = md?.materials || [];
  const total = md?.total || 0;

  function openAdd() { setForm({}); setModal('add'); }
  function openEdit(m) { setForm({ ...m }); setModal('edit'); }
  function closeModal() { setModal(null); setForm({}); }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const isEdit = modal === 'edit';
      const res = await fetch(isEdit ? `/api/materials/${form.id}` : '/api/materials', {
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

  const deactivate = useCallback(async (id) => {
    if (!confirm(t('common.confirmDeactivate'))) return;
    const res = await fetch(`/api/materials/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setToast({ kind: 'success', text: t('common.deactivated') }); mutate(); }
    else { const d = await res.json(); setToast({ kind: 'error', text: d.error }); }
  }, [mutate, t]);

  const categoryOptions = [{ value: '', label: t('common.selectCategory') }, ...(cats?.categories || []).map(c => ({ value: c.id, label: c.name }))];
  const unitOptions = [{ value: '', label: t('common.selectUnit') }, ...(units?.units || []).map(u => ({ value: u.id, label: `${u.name}${u.symbol ? ' (' + u.symbol + ')' : ''}` }))];

  return (
    <Shell active="/materials">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('materials.searchPlaceholder')} className="ginput" />
        </div>
        <button onClick={openAdd} className="gbtn gbtn-primary">
          <GlassIcon name="plus" size={16} bare />{t('materials.addMaterial')}
        </button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('materials.materialCode')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.category')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('stock.qtyOnHand')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('materials.costPrice')}</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {materials.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>
              )}
              {materials.map(m => (
                <tr key={m.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium">{m.name}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.material_code || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{m.inv_categories?.name || '—'}</td>
                  <td className="px-4 py-3 text-end font-semibold">{Number(m.qty_on_hand || 0).toLocaleString()} <span className="text-[color:var(--tx-3)] font-normal text-xs">{m.inv_units?.symbol || ''}</span></td>
                  <td className="px-4 py-3 text-end">SAR {Number(m.cost_price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (m.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[color:var(--pr-soft)] text-[color:var(--tx-3)]')}>
                      {m.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(m)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                      {m.is_active && <button onClick={() => deactivate(m.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>}
                    </div>
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

      {modal && (
        <GlassModal title={modal === 'add' ? t('materials.addMaterial') : t('materials.editMaterial')} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder={t('materials.namePlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('materials.materialCode')}</label>
              <GlassInput value={form.material_code || ''} onChange={v => setForm(f => ({ ...f, material_code: v }))} placeholder="MAT-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.unit')}</label>
              <GlassSelect value={form.unit_id || ''} onChange={v => setForm(f => ({ ...f, unit_id: v }))} options={unitOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.category')}</label>
              <GlassSelect value={form.category_id || ''} onChange={v => setForm(f => ({ ...f, category_id: v }))} options={categoryOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('materials.costPrice')}</label>
              <GlassInput type="number" value={form.cost_price || ''} onChange={v => setForm(f => ({ ...f, cost_price: v }))} placeholder="0.00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('stock.minQty')}</label>
              <GlassInput type="number" value={form.min_stock_qty || ''} onChange={v => setForm(f => ({ ...f, min_stock_qty: v }))} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.description')}</label>
              <GlassTextarea value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={closeModal} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={save} disabled={busy || !form.name} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
