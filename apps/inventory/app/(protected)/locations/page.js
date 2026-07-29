'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassToast } from '@/components/glass';

const LOCATION_TYPES = [
  { value: 'zone', label: 'Zone' },
  { value: 'rack', label: 'Rack' },
  { value: 'shelf', label: 'Shelf' },
  { value: 'bin', label: 'Bin' },
  { value: 'floor', label: 'Floor' },
];

export default function LocationsPage() {
  const { t } = useLanguage();
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: wd } = useLiveData('/api/warehouses', 0);
  const { data: ld, mutate } = useLiveData(
    `/api/locations${selectedWarehouse ? '?warehouse_id=' + selectedWarehouse : ''}`, 0
  );
  const warehouses = wd?.warehouses || [];
  const locations = ld?.locations || [];

  const whOptions = [{ value: '', label: t('common.allWarehouses') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
  const whFormOptions = [{ value: '', label: t('warehouses.selectWarehouse') }, ...warehouses.map(w => ({ value: w.id, label: w.name }))];
  const typeOptions = [{ value: '', label: t('common.select') }, ...LOCATION_TYPES];

  function openAdd() { setForm({ warehouse_id: selectedWarehouse || '' }); setModal('add'); }
  function openEdit(l) { setForm({ ...l }); setModal('edit'); }
  function closeModal() { setModal(null); setForm({}); }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const isEdit = modal === 'edit';
      const res = await fetch('/api/locations', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: isEdit ? t('common.updated') : t('common.created') });
      closeModal(); mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, modal, mutate, t]);

  const deactivate = useCallback(async (id) => {
    if (!confirm(t('common.confirmDeactivate'))) return;
    const res = await fetch(`/api/locations?id=${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setToast({ kind: 'success', text: t('common.deactivated') }); mutate(); }
    else { const d = await res.json(); setToast({ kind: 'error', text: d.error }); }
  }, [mutate, t]);

  return (
    <Shell active="/locations">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <GlassSelect value={selectedWarehouse} onChange={setSelectedWarehouse} options={whOptions} />
        <button onClick={openAdd} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('locations.addLocation')}</button>
      </div>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
            <tr>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('locations.code')}</th>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.type')}</th>
              <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--bd)]">
            {locations.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
            {locations.map(l => (
              <tr key={l.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                <td className="px-4 py-3 font-medium">{l.name}</td>
                <td className="px-4 py-3 text-[color:var(--tx-3)]">{l.code || '—'}</td>
                <td className="px-4 py-3 text-[color:var(--tx-3)]">{l.inv_warehouses?.name || '—'}</td>
                <td className="px-4 py-3 text-[color:var(--tx-3)] capitalize">{l.type || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + (l.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[color:var(--pr-soft)] text-[color:var(--tx-3)]')}>
                    {l.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(l)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                    {l.is_active && <button onClick={() => deactivate(l.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <GlassModal title={modal === 'add' ? t('locations.addLocation') : t('locations.editLocation')} onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('nav.warehouses')} *</label>
              <GlassSelect value={form.warehouse_id || ''} onChange={v => setForm(f => ({ ...f, warehouse_id: v }))} options={whFormOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="Row A, Shelf B1..." />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('locations.code')}</label>
              <GlassInput value={form.code || ''} onChange={v => setForm(f => ({ ...f, code: v }))} placeholder="LOC-001" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.type')}</label>
              <GlassSelect value={form.type || ''} onChange={v => setForm(f => ({ ...f, type: v }))} options={typeOptions} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={closeModal} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={save} disabled={busy || !form.name || !form.warehouse_id} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
