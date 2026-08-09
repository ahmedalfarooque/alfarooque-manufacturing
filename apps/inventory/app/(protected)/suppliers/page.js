'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 30000;

export default function SuppliersPage() {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: sd, mutate } = useLiveData(`/api/suppliers?search=${encodeURIComponent(search)}&page=${page}&limit=50`, REFRESH_MS);
  const suppliers = sd?.suppliers || [];
  const total = sd?.total || 0;

  function openAdd() { setForm({ country: 'Saudi Arabia' }); setModal('add'); }
  function openEdit(s) { setForm({ ...s }); setModal('edit'); }
  function closeModal() { setModal(null); setForm({}); }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const isEdit = modal === 'edit';
      const res = await fetch(isEdit ? `/api/suppliers/${form.id}` : '/api/suppliers', {
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
    const res = await fetch(`/api/suppliers/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setToast({ kind: 'success', text: t('common.deactivated') }); mutate(); }
    else { const d = await res.json(); setToast({ kind: 'error', text: d.error }); }
  }, [mutate, t]);

  return (
    <Shell active="/suppliers">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder={t('suppliers.searchPlaceholder')} className="ginput flex-1 max-w-sm" />
        <button onClick={openAdd} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('suppliers.addSupplier')}</button>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('suppliers.contactPerson')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.email')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('suppliers.phone')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('suppliers.city')}</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {suppliers.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {suppliers.map(s => (
                <tr key={s.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{s.contact_person || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{s.email || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{s.phone || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{s.city || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (s.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[color:var(--pr-soft)] text-[color:var(--tx-3)]')}>
                      {s.is_active ? t('common.active') : t('common.inactive')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(s)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                      {s.is_active && <button onClick={() => deactivate(s.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>}
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
        <GlassModal title={modal === 'add' ? t('suppliers.addSupplier') : t('suppliers.editSupplier')} onClose={closeModal}>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.contactPerson')}</label>
              <GlassInput value={form.contact_person || ''} onChange={v => setForm(f => ({ ...f, contact_person: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.email')}</label>
              <GlassInput type="email" value={form.email || ''} onChange={v => setForm(f => ({ ...f, email: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.phone')}</label>
              <GlassInput value={form.phone || ''} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.vatNumber')}</label>
              <GlassInput value={form.vat_number || ''} onChange={v => setForm(f => ({ ...f, vat_number: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.city')}</label>
              <GlassInput value={form.city || ''} onChange={v => setForm(f => ({ ...f, city: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.country')}</label>
              <GlassInput value={form.country || ''} onChange={v => setForm(f => ({ ...f, country: v }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.address')}</label>
              <GlassTextarea value={form.address || ''} onChange={v => setForm(f => ({ ...f, address: v }))} rows={2} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.notes')}</label>
              <GlassTextarea value={form.notes || ''} onChange={v => setForm(f => ({ ...f, notes: v }))} rows={2} />
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
