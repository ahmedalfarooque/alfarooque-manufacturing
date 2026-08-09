'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage, trEnum } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const REFRESH_MS = 20000;
const STATUS_COLORS = { pending: 'text-amber-500 bg-amber-500/10', approved: 'text-emerald-500 bg-emerald-500/10', rejected: 'text-red-500 bg-red-500/10', ordered: 'text-blue-500 bg-blue-500/10' };
const PRIORITY_COLORS = { low: 'text-slate-400', normal: 'text-[color:var(--tx-3)]', high: 'text-amber-500', urgent: 'text-red-500' };

export default function PurchaseRequestsPage() {
  const { t } = useLanguage();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ title: '', priority: 'normal', items: [{ product_id: '', material_id: '', qty_requested: 1, unit_cost: 0, notes: '' }] });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [rejectNote, setRejectNote] = useState('');

  const params = new URLSearchParams({ page, limit: 50 });
  if (statusFilter) params.set('status', statusFilter);
  const { data: pd, mutate } = useLiveData(`/api/purchase-requests?${params}`, REFRESH_MS);
  const { data: prods } = useLiveData('/api/products?limit=200', 0);
  const { data: mats } = useLiveData('/api/materials?limit=200', 0);

  const requests = pd?.requests || [];
  const total = pd?.total || 0;

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

  return (
    <Shell active="/purchase-requests">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <GlassSelect value={statusFilter} onChange={v => { setStatusFilter(v); setPage(1); }} options={statusOptions} />
        <button onClick={() => setModal('add')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('pr.addRequest')}</button>
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
        <GlassModal title={t('pr.addRequest')} onClose={() => setModal(null)} wide>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.title')} *</label>
                <GlassInput value={form.title} onChange={v => setForm(f => ({ ...f, title: v }))} placeholder={t('pr.titlePlaceholder')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('pr.priority')}</label>
                <GlassSelect value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={priorityOptions} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('pr.neededBy')}</label>
                <GlassInput type="date" value={form.needed_by || ''} onChange={v => setForm(f => ({ ...f, needed_by: v }))} />
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
                      <GlassInput type="number" value={item.qty_requested} onChange={v => updateItem(i, 'qty_requested', v)} placeholder={t('common.qty')} />
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
              <GlassTextarea value={rejectNote} onChange={setRejectNote} rows={2} />
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
