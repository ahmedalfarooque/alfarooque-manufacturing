'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassTextarea, GlassToast, GlassButton } from '@/components/glass';

export default function WarehousesPage() {
  const { t, lang } = useLanguage();
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [reportBusy, setReportBusy] = useState('');
  const { data: wd, mutate } = useLiveData('/api/warehouses', 0);
  const warehouses = wd?.warehouses || [];

  async function runReport(action) {
    setReportBusy(action);
    try {
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({
        title: t('warehouses.addWarehouse').replace(/^\+\s*/, '') || 'Warehouses',
        columns: [
          { key: 'name', header: t('common.name') }, { key: 'code', header: t('warehouses.code') },
          { key: 'city', header: t('suppliers.city') }, { key: 'address', header: t('suppliers.address') },
          { key: 'status', header: t('common.status') },
        ],
        rows: warehouses.map(w => ({
          name: w.name || '—', code: w.code || '—', city: w.city || '—',
          address: w.address || '—', status: w.is_active ? t('common.active') : t('common.inactive'),
        })),
        lang, fileName: 'warehouses-report.pdf', action,
      });
    } catch (e) { setToast({ kind: 'error', text: e.message || 'Could not generate report.' }); }
    finally { setReportBusy(''); }
  }

  function openAdd() { setForm({}); setModal('add'); }
  function openEdit(w) { setForm({ ...w }); setModal('edit'); }
  function closeModal() { setModal(null); setForm({}); }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const isEdit = modal === 'edit';
      const res = await fetch(isEdit ? `/api/warehouses/${form.id}` : '/api/warehouses', {
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
    const res = await fetch(`/api/warehouses/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setToast({ kind: 'success', text: t('common.deactivated') }); mutate(); }
    else { const d = await res.json(); setToast({ kind: 'error', text: d.error }); }
  }, [mutate, t]);

  return (
    <Shell active="/warehouses">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex justify-end gap-2 mb-4">
        <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!warehouses.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('materials.print')}</GlassButton>
        <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!warehouses.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('materials.downloadPdf')}</GlassButton>
        <button onClick={openAdd} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('warehouses.addWarehouse')}</button>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
            <tr>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('warehouses.code')}</th>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('suppliers.city')}</th>
              <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('suppliers.address')}</th>
              <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--bd)]">
            {warehouses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
            {warehouses.map(w => (
              <tr key={w.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                <td className="px-4 py-3 font-medium">{w.name}{w.read_only && <span className="ms-2 text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600" title={t('sl.readOnlyShort')}>{t('sl.badge')}</span>}</td>
                <td className="px-4 py-3 text-[color:var(--tx-3)]">{w.code || '—'}</td>
                <td className="px-4 py-3 text-[color:var(--tx-3)]">{w.city || '—'}</td>
                <td className="px-4 py-3 text-[color:var(--tx-3)]">{w.address || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className={'text-xs px-2 py-0.5 rounded-full ' + (w.is_active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-[color:var(--pr-soft)] text-[color:var(--tx-3)]')}>
                    {w.is_active ? t('common.active') : t('common.inactive')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    {!w.read_only && <>
                      <button onClick={() => openEdit(w)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                      {w.is_active && <button onClick={() => deactivate(w.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>}
                    </>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {modal && (
        <GlassModal title={modal === 'add' ? t('warehouses.addWarehouse') : t('warehouses.editWarehouse')} onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('warehouses.code')}</label>
              <GlassInput value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="WH-01" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.city')}</label>
              <GlassInput value={form.city || ''} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('suppliers.address')}</label>
              <GlassTextarea value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={2} />
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
