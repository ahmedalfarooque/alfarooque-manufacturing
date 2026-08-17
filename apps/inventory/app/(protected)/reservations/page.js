'use client';

import { useMemo, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { useAllPages } from '@/lib/useAllPages';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast, GlassBadge, GlassButton } from '@/components/glass';
import DateFilter, { inDateFilter } from '@/components/DateFilter';
import Pagination from '@/components/Pagination';

const REFRESH_MS = 15000;
const REF_TYPES = ['sales_order', 'project', 'other'];

export default function ReservationsPage() {
  const { t, lang } = useLanguage();
  const [status, setStatus] = useState('active');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ warehouse_id: '', reference_type: 'other', qty: 1 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [reportBusy, setReportBusy] = useState('');

  /* Full dataset under the active status filter — date filtering,
     newest-first sort and pagination happen client-side over the complete
     set, not just one server page. */
  const { rows: allReservations, mutate } = useAllPages('/api/reservations', { status }, 'reservations', { intervalMs: REFRESH_MS, pageLimit: 200 });
  const { data: wd } = useLiveData('/api/warehouses', 0);
  const { data: prods } = useLiveData('/api/products?limit=200', 0);
  const { data: mats } = useLiveData('/api/materials?limit=200', 0);

  const filtered = useMemo(() => {
    const rows = allReservations.filter(r => inDateFilter(dateFilter, r.created_at));
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return rows;
  }, [allReservations, dateFilter]);
  const total = filtered.length;
  const reservations = filtered.slice((page - 1) * pageSize, page * pageSize);
  const warehouses = wd?.warehouses || [];

  const statusOptions = [
    { value: 'active', label: t('resv.status.active') },
    { value: 'fulfilled', label: t('resv.status.fulfilled') },
    { value: 'released', label: t('resv.status.released') },
    { value: 'all', label: t('common.all') },
  ];
  const warehouseOptions = [{ value: '', label: t('warehouses.selectWarehouse') }, ...warehouses.filter(w => w.is_active).map(w => ({ value: w.id, label: w.name }))];
  const productOptions = [{ value: '', label: t('common.select') }, ...(prods?.products || []).map(p => ({ value: 'p:' + p.id, label: p.name }))];
  const materialOptions = (mats?.materials || []).map(m => ({ value: 'm:' + m.id, label: m.name }));
  const allItemOptions = [...productOptions, { value: '', label: '── Materials ──', disabled: true }, ...materialOptions];
  const refTypeOptions = REF_TYPES.map(v => ({ value: v, label: t('gi.refType.' + v) }));

  function setItemRef(val) {
    if (val.startsWith('p:')) setForm(f => ({ ...f, product_id: val.slice(2), material_id: '' }));
    else if (val.startsWith('m:')) setForm(f => ({ ...f, material_id: val.slice(2), product_id: '' }));
    else setForm(f => ({ ...f, product_id: '', material_id: '' }));
  }
  function getItemRef() {
    if (form.product_id) return 'p:' + form.product_id;
    if (form.material_id) return 'm:' + form.material_id;
    return '';
  }

  const submit = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.created') });
      setModal(null);
      setForm({ warehouse_id: '', reference_type: 'other', qty: 1 });
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, mutate, t]);

  const act = useCallback(async (id, action) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: action === 'fulfill' ? t('resv.fulfilled') : t('resv.released') });
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    }
  }, [mutate, t]);

  function badgeTone(s) { return s === 'active' ? 'info' : s === 'fulfilled' ? 'success' : 'neutral'; }

  const reportColumns = [
    { key: 'name', header: t('common.name') }, { key: 'warehouse', header: t('nav.warehouses') },
    { key: 'qty', header: t('resv.qty') }, { key: 'reference', header: t('resv.reference') },
    { key: 'status', header: t('common.status') },
  ];
  function toReportRow(r) {
    return {
      name: r.inv_products?.name || r.inv_materials?.name || '—', warehouse: r.inv_warehouses?.name || '—',
      qty: Number(r.qty).toLocaleString(), reference: r.reference_label || t('gi.refType.' + (r.reference_type || 'other')),
      status: t('resv.status.' + r.status),
    };
  }

  /* Export must reflect the full filtered (status + date) set, not just
     the current page — `filtered` is already the complete, date-filtered
     dataset kept in memory by useAllPages. */
  async function runReport(action) {
    setReportBusy(action);
    try {
      const rows = filtered.map(toReportRow);
      if (action === 'excel') {
        const res = await fetch('/api/export/xlsx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ sheetName: t('nav.reservations') || 'Reservations', columns: reportColumns, rows, filename: 'reservations-report.xlsx' }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not generate Excel export.'); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'reservations-report.xlsx'; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({ title: t('nav.reservations') || 'Reservations', columns: reportColumns, rows, lang, fileName: 'reservations-report.pdf', action });
    } catch (e) { setToast({ kind: 'error', text: e.message || 'Could not generate report.' }); }
    finally { setReportBusy(''); }
  }

  return (
    <Shell active="/reservations">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} options={statusOptions} />
        <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
        <div className="ms-auto flex items-center gap-2">
          <span className="text-sm text-[color:var(--tx-3)]">{t('common.total')}: {total}</span>
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!reservations.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('materials.print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!reservations.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('materials.downloadPdf')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('excel')} disabled={!reservations.length || !!reportBusy}>{reportBusy === 'excel' ? '…' : 'Download Excel'}</GlassButton>
          <button onClick={() => setModal('add')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('resv.addReservation')}</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('nav.warehouses')}</th>
                <th className="text-end px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('resv.qty')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('resv.reference')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {reservations.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {reservations.map(r => (
                <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-medium">{r.inv_products?.name || r.inv_materials?.name || '—'}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.inv_warehouses?.name || '—'}</td>
                  <td className="px-4 py-3 text-end font-semibold">{Number(r.qty).toLocaleString()}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.reference_label || t('gi.refType.' + (r.reference_type || 'other'))}</td>
                  <td className="px-4 py-3"><GlassBadge tone={badgeTone(r.status)}>{t('resv.status.' + r.status)}</GlassBadge></td>
                  <td className="px-4 py-3">
                    {r.status === 'active' && (
                      <div className="flex gap-1">
                        <button onClick={() => act(r.id, 'fulfill')} className="gbtn gbtn-ghost gbtn--sm">{t('resv.fulfill')}</button>
                        <button onClick={() => act(r.id, 'release')} className="gbtn gbtn-ghost gbtn--sm text-red-500">{t('resv.release')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} t={t} />
      </div>

      {modal === 'add' && (
        <GlassModal title={t('resv.addReservation')} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassSelect value={getItemRef()} onChange={e => setItemRef(e.target.value)} options={allItemOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('nav.warehouses')} *</label>
              <GlassSelect value={form.warehouse_id} onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))} options={warehouseOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('resv.qty')} *</label>
              <GlassInput type="number" value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('gi.refType')}</label>
              <GlassSelect value={form.reference_type} onChange={e => setForm(f => ({ ...f, reference_type: e.target.value }))} options={refTypeOptions} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('resv.referenceLabel')}</label>
              <GlassInput value={form.reference_label || ''} onChange={e => setForm(f => ({ ...f, reference_label: e.target.value }))} placeholder={t('resv.referenceLabelPlaceholder')} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.notes')}</label>
              <GlassTextarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setModal(null)} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={submit} disabled={busy || !form.warehouse_id || (!form.product_id && !form.material_id)} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
