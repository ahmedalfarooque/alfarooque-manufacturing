'use client';

import { useMemo, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage, trEnum } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { useAllPages } from '@/lib/useAllPages';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast, GlassButton } from '@/components/glass';
import DateFilter, { inDateFilter } from '@/components/DateFilter';
import Pagination from '@/components/Pagination';

const REFRESH_MS = 20000;
const STATUS_COLORS = { pending: 'text-amber-500 bg-amber-500/10', approved: 'text-emerald-500 bg-emerald-500/10', rejected: 'text-red-500 bg-red-500/10', ordered: 'text-blue-500 bg-blue-500/10' };
const PRIORITY_COLORS = { low: 'text-slate-400', normal: 'text-[color:var(--tx-3)]', high: 'text-amber-500', urgent: 'text-red-500' };

export default function PurchaseRequestsPage() {
  const { t, lang } = useLanguage();
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState({ preset: 'all', from: null, to: null });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: '', priority: 'normal', items: [{ product_id: '', material_id: '', qty_requested: 1, unit_cost: 0, notes: '' }] });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reportBusy, setReportBusy] = useState('');

  const extraParams = {};
  if (statusFilter) extraParams.status = statusFilter;
  const { rows: allRequests, mutate } = useAllPages('/api/purchase-requests', extraParams, 'requests', { intervalMs: REFRESH_MS, pageLimit: 200 });
  const { data: prods } = useLiveData('/api/products?limit=200', 0);
  const { data: mats } = useLiveData('/api/materials?limit=200', 0);

  const filtered = useMemo(() => {
    const rows = allRequests.filter(r => inDateFilter(dateFilter, r.created_at));
    rows.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    return rows;
  }, [allRequests, dateFilter]);
  const total = filtered.length;
  const requests = filtered.slice((page - 1) * pageSize, page * pageSize);

  const statusOptions = [
    { value: '', label: t('common.allStatuses') },
    { value: 'pending', label: trEnum(t, 'prStatus', 'pending') },
    { value: 'approved', label: trEnum(t, 'prStatus', 'approved') },
    { value: 'rejected', label: trEnum(t, 'prStatus', 'rejected') },
    { value: 'ordered', label: trEnum(t, 'prStatus', 'ordered') },
  ];
  const priorityOptions = [
    { value: 'low', label: trEnum(t, 'priority', 'low') },
    { value: 'normal', label: trEnum(t, 'priority', 'normal') },
    { value: 'high', label: trEnum(t, 'priority', 'high') },
    { value: 'urgent', label: trEnum(t, 'priority', 'urgent') },
  ];
  const productOptions = [{ value: '', label: t('common.selectProduct') }, ...(prods?.products || []).map(p => ({ value: 'p:' + p.id, label: p.name + (p.sku ? ' (' + p.sku + ')' : '') }))];
  const materialOptions = (mats?.materials || []).map(m => ({ value: 'm:' + m.id, label: m.name + (m.material_code ? ' (' + m.material_code + ')' : '') }));
  const allItemOptions = [...productOptions, { value: '', label: '── Materials ──', disabled: true }, ...materialOptions];

  function addItem() { setForm(f => ({ ...f, items: [...f.items, { product_id: '', material_id: '', qty_requested: 1, unit_cost: 0 }] })); }
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
      const res = await fetch('/api/purchase-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.created') });
      setModal(null);
      setForm({ title: '', priority: 'normal', items: [{ product_id: '', material_id: '', qty_requested: 1, unit_cost: 0 }] });
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, mutate, t]);

  const action = useCallback(async (id, act) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/purchase-requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: act, notes: rejectNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ kind: 'success', text: t('common.updated') });
      setModal(null); setSelected(null); setRejectNote('');
      mutate();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [mutate, rejectNote, t]);

  const reportColumns = [
    { key: 'number', header: t('common.number') }, { key: 'title', header: t('common.title') },
    { key: 'priority', header: t('pr.priority') }, { key: 'requestedBy', header: t('common.requestedBy') },
    { key: 'status', header: t('common.status') }, { key: 'date', header: t('common.date') },
  ];
  function toReportRow(r) {
    return {
      number: r.pr_number || r.id.slice(0, 8), title: r.title || '—', priority: trEnum(t, 'priority', r.priority),
      requestedBy: r.platform_users?.full_name || '—', status: trEnum(t, 'prStatus', r.status),
      date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '—',
    };
  }

  async function runReport(action) {
    setReportBusy(action);
    try {
      const rows = filtered.map(toReportRow);
      if (action === 'excel') {
        const res = await fetch('/api/export/xlsx', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
          body: JSON.stringify({ sheetName: t('nav.purchaseRequests') || 'Purchase Requests', columns: reportColumns, rows, filename: 'purchase-requests-report.xlsx' }),
        });
        if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Could not generate Excel export.'); }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'purchase-requests-report.xlsx'; a.click();
        URL.revokeObjectURL(url);
        return;
      }
      const { exportReportPdf } = await import('@/lib/reportPdf');
      await exportReportPdf({ title: t('nav.purchaseRequests') || 'Purchase Requests', columns: reportColumns, rows, lang, fileName: 'purchase-requests-report.pdf', action });
    } catch (e) { setToast({ kind: 'error', text: e.message || 'Could not generate report.' }); }
    finally { setReportBusy(''); }
  }

  return (
    <Shell active="/purchase-requests">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <GlassSelect value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} options={statusOptions} />
          <DateFilter value={dateFilter} onChange={v => { setDateFilter(v); setPage(1); }} t={t} lang={lang} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[color:var(--tx-3)]">{t('common.total')}: {total}</span>
          <GlassButton variant="secondary" onClick={() => runReport('print')} disabled={!requests.length || !!reportBusy}>{reportBusy === 'print' ? '…' : t('materials.print')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('save')} disabled={!requests.length || !!reportBusy}>{reportBusy === 'save' ? '…' : t('materials.downloadPdf')}</GlassButton>
          <GlassButton variant="secondary" onClick={() => runReport('excel')} disabled={!requests.length || !!reportBusy}>{reportBusy === 'excel' ? '…' : 'Download Excel'}</GlassButton>
          <button onClick={() => setModal('add')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('pr.addRequest')}</button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
              <tr>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.number')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.title')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('pr.priority')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.requestedBy')}</th>
                <th className="text-center px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.status')}</th>
                <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.date')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--bd)]">
              {requests.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
              {requests.map(r => (
                <tr key={r.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs">{r.pr_number || r.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className={'px-4 py-3 font-medium ' + (PRIORITY_COLORS[r.priority] || '')}>{trEnum(t, 'priority', r.priority)}</td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.platform_users?.full_name || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={'text-xs px-2 py-0.5 rounded-full ' + (STATUS_COLORS[r.status] || '')}>
                      {trEnum(t, 'prStatus', r.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[color:var(--tx-3)]">{r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">
                    {r.status === 'pending' && (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setSelected(r); setModal('approve'); }} className="gbtn gbtn-ghost gbtn--sm text-emerald-500">{t('pr.approve')}</button>
                        <button onClick={() => { setSelected(r); setModal('reject'); }} className="gbtn gbtn-ghost gbtn--sm text-red-500">{t('pr.reject')}</button>
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
        <GlassModal title={t('pr.addRequest')} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.title')} *</label>
                <GlassInput value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={t('pr.titlePlaceholder')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('pr.priority')}</label>
                <GlassSelect value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} options={priorityOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('pr.neededBy')}</label>
                <GlassInput type="date" value={form.needed_by || ''} onChange={e => setForm(f => ({ ...f, needed_by: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.notes')}</label>
                <GlassTextarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
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
                      <GlassSelect value={getItemRef(item)} onChange={e => updateItem(i, 'item_ref', e.target.value)} options={allItemOptions} />
                    </div>
                    <div className="col-span-3">
                      <GlassInput type="number" value={item.qty_requested} onChange={e => updateItem(i, 'qty_requested', e.target.value)} placeholder={t('common.qty')} />
                    </div>
                    <div className="col-span-3">
                      <GlassInput type="number" value={item.unit_cost} onChange={e => updateItem(i, 'unit_cost', e.target.value)} placeholder={t('stock.unitCost')} />
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
            <button onClick={submit} disabled={busy || !form.title} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.submit')}</button>
          </div>
        </GlassModal>
      )}

      {(modal === 'approve' || modal === 'reject') && selected && (
        <GlassModal title={modal === 'approve' ? t('pr.approveRequest') : t('pr.rejectRequest')} onClose={() => { setModal(null); setSelected(null); }}>
          <p className="text-sm mb-4">{modal === 'approve' ? t('pr.confirmApprove') : t('pr.confirmReject')} <strong>{selected.title}</strong>?</p>
          {modal === 'reject' && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('pr.rejectReason')}</label>
              <GlassTextarea value={rejectNote} onChange={e => setRejectNote(e.target.value)} rows={2} />
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setModal(null); setSelected(null); }} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={() => action(selected.id, modal)} disabled={busy} className={'gbtn ' + (modal === 'approve' ? 'gbtn-primary' : 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20')}>
              {busy ? t('common.saving') : (modal === 'approve' ? t('pr.approve') : t('pr.reject'))}
            </button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
