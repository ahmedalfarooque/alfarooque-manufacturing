'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLanguage, trEnum } from '@/lib/i18n';
import { Button, Field, Input } from '@/components/ui';
import { SO_STATUS_BADGE } from '../page';

function money(n, c) { return `${c || 'SAR'} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`; }

export default function SalesOrderDetailPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/sales-orders/${id}`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(t('so.notFound')));
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  async function removeLine(lineId) {
    const res = await fetch(`/api/sales-orders/${id}/lines/${lineId}`, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
    if (res && res.ok) load(); else alert(t('so.couldNotUpdate'));
  }

  async function act(action) {
    if (action === 'cancel' && !confirm(t('so.confirmCancel'))) return;
    setBusy(true);
    const res = await fetch(`/api/sales-orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ action }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) { alert(d.error || t('so.couldNotUpdate')); return; }
    load();
  }

  if (error) return <Shell active="/sales-orders"><div className="text-red-500 text-sm">{error}</div></Shell>;
  if (!data) return <Shell active="/sales-orders"><div className="text-[color:var(--tx-3)] text-sm">{t('common.loading')}</div></Shell>;

  const so = data.salesOrder;
  const lines = data.lines || [];

  return (
    <Shell active="/sales-orders">
      <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs text-[color:var(--tx-3)] mb-1"><a href="/sales-orders" className="hover:underline">{t('so.title')}</a> &gt; {t('so.breadcrumbDetails')}</p>
          <h2 className="text-lg font-semibold" dir="ltr">{so.so_number || so.id.slice(0, 8)}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{so.customer_name}</p>
        </div>
        <span className={'px-3 py-1.5 rounded-full text-sm font-medium ' + (SO_STATUS_BADGE[so.status] || '')}>{trEnum(t, 'status', so.status)}</span>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card glass-card--pad">
            <h3 className="font-medium text-sm mb-3">{t('so.lines')}</h3>
            {lines.length === 0 ? (
              <div className="text-sm text-[color:var(--tx-3)] py-4 text-center">{t('so.noneFound')}</div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-[color:var(--tx-3)]">
                    <tr>
                      <th className="py-2">{t('so.description')}</th>
                      <th className="py-2">{t('so.qty')}</th>
                      <th className="py-2">{t('so.unitPrice')}</th>
                      <th className="py-2">{t('so.lineTotal')}</th>
                      {so.status === 'Draft' && <th className="py-2"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map(l => (
                      <tr key={l.id} className="border-t border-[color:var(--bd)]">
                        <td className="py-2">{l.description || l.inv_products?.name || l.inv_materials?.name || '—'}</td>
                        <td className="py-2" dir="ltr">{l.qty}</td>
                        <td className="py-2" dir="ltr">{money(l.unit_price, so.currency)}</td>
                        <td className="py-2" dir="ltr">{money(Number(l.qty) * Number(l.unit_price), so.currency)}</td>
                        {so.status === 'Draft' && (
                          <td className="py-2 text-end">
                            <button onClick={() => removeLine(l.id)} className="text-[color:var(--tx-3)] hover:text-red-500" title={t('common.delete')}>✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {so.status === 'Draft' && <AddLineForm soId={so.id} onAdded={load} />}
          </div>

          <div className="glass-card glass-card--pad flex flex-wrap items-center gap-2">
            {so.status === 'Draft' && <button disabled={busy} onClick={() => act('reserve')} className="gbtn gbtn--sm disabled:opacity-50">{t('so.act.reserve')}</button>}
            {so.status === 'Reserved' && <button disabled={busy} onClick={() => act('deliver')} className="gbtn gbtn--sm disabled:opacity-50">{t('so.act.deliver')}</button>}
            {['Delivered', 'Draft'].includes(so.status) && <button disabled={busy} onClick={() => act('invoice')} className="gbtn gbtn-success gbtn--sm disabled:opacity-50">{t('so.act.invoice')}</button>}
            {so.status === 'Invoiced' && <button disabled={busy} onClick={() => act('mark-paid')} className="gbtn gbtn-success gbtn--sm disabled:opacity-50">{t('so.act.markPaid')}</button>}
            {!['Paid', 'Cancelled'].includes(so.status) && <button disabled={busy} onClick={() => act('cancel')} className="gbtn gbtn-danger gbtn--sm disabled:opacity-50">{t('so.act.cancel')}</button>}
          </div>
        </div>

        <div className="space-y-4">
          <div className="glass-card glass-card--pad text-sm space-y-2">
            <Row label={t('so.customer')} value={so.customer_name} />
            <Row label={t('so.currency')} value={so.currency} />
            <Row label={t('so.col.total')} value={money(so.total_amount, so.currency)} />
            {data.quotation && <Row label={t('so.quotation')} value={<a className="hover:underline" href={'/quotation-requests'}>{data.quotation.quote_number}</a>} />}
            {data.project && <Row label={t('so.project')} value={<a className="hover:underline" href={'/projects/' + data.project.id}>{data.project.project_name}</a>} />}
            {data.invoice && <Row label={t('so.invoice')} value={data.invoice.invoice_number || data.invoice.id.slice(0, 8)} />}
            {so.notes && <Row label={t('so.notes')} value={so.notes} />}
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[color:var(--tx-3)]">{label}</span>
      <span className="text-end">{value ?? '—'}</span>
    </div>
  );
}

function AddLineForm({ soId, onAdded }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ description: '', qty: 1, unit_price: '', warehouse_id: '' });
  const [invQuery, setInvQuery] = useState('');
  const [invResults, setInvResults] = useState(null);
  const [invPicked, setInvPicked] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [busy, setBusy] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    fetch('/api/warehouses', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => d && setWarehouses(d.warehouses || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const query = invQuery.trim();
    if (query.length < 2) { setInvResults(null); return; }
    const timer = setTimeout(() => {
      fetch('/api/inventory-search?q=' + encodeURIComponent(query), { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(d => d && setInvResults(d))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [invQuery]);

  function pickItem(item, kind) {
    setInvPicked({ ...item, kind });
    setInvResults(null);
    setInvQuery('');
    setForm(f => ({ ...f, description: f.description || item.name, unit_price: f.unit_price || item.cost_price || '' }));
  }

  function clearPicked() { setInvPicked(null); }

  async function submit(e) {
    e.preventDefault();
    if (!form.description.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/sales-orders/${soId}/lines`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        description: form.description,
        qty: form.qty,
        unit_price: form.unit_price,
        warehouse_id: form.warehouse_id || null,
        inv_product_id: invPicked?.kind === 'product' ? invPicked.id : null,
        inv_material_id: invPicked?.kind === 'material' ? invPicked.id : null,
      }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) {
      setForm({ description: '', qty: 1, unit_price: '', warehouse_id: '' });
      setInvPicked(null);
      onAdded();
    } else alert(t('so.couldNotUpdate'));
  }

  return (
    <form onSubmit={submit} className="mt-4 pt-4 border-t border-[color:var(--bd)] grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
      <div className="col-span-2 relative">
        <Field label={t('so.inventoryItem')}>
          {invPicked ? (
            <div className="flex items-center justify-between text-sm px-3 py-2 rounded-lg border border-[color:var(--bd)]">
              <span className="truncate">{invPicked.name}</span>
              <button type="button" onClick={clearPicked} className="text-[color:var(--tx-3)]">✕</button>
            </div>
          ) : (
            <Input placeholder={t('so.searchInventory')} value={invQuery} onChange={e => setInvQuery(e.target.value)} />
          )}
        </Field>
        {invResults && (invResults.products?.length > 0 || invResults.materials?.length > 0) && (
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-[color:var(--bd)] bg-[color:var(--nav-bg)] backdrop-blur-xl shadow-lg">
            {invResults.products?.map(p => (
              <button type="button" key={'p' + p.id} onClick={() => pickItem(p, 'product')} className="block w-full text-start px-3 py-2 text-sm hover:bg-[color:var(--pr-soft)]">{p.name} <span className="text-xs text-[color:var(--tx-3)]">({p.sku})</span></button>
            ))}
            {invResults.materials?.map(m => (
              <button type="button" key={'m' + m.id} onClick={() => pickItem(m, 'material')} className="block w-full text-start px-3 py-2 text-sm hover:bg-[color:var(--pr-soft)]">{m.name} <span className="text-xs text-[color:var(--tx-3)]">({m.material_code})</span></button>
            ))}
          </div>
        )}
      </div>
      <Field label={t('so.description')}><Input value={form.description} onChange={set('description')} required /></Field>
      <Field label={t('so.qty')}><Input type="number" min="0" step="any" value={form.qty} onChange={set('qty')} /></Field>
      <Field label={t('so.unitPrice')}><Input type="number" min="0" step="any" value={form.unit_price} onChange={set('unit_price')} /></Field>
      <Field label={t('so.warehouse')}>
        <Dropdown value={form.warehouse_id} onChange={v => setForm(f => ({ ...f, warehouse_id: v }))} placeholder="—" options={[['', '—'], ...warehouses.map(w => [w.id, w.name])]} />
      </Field>
      <div>
        <Button type="submit" disabled={busy}>{t('so.addLine')}</Button>
      </div>
    </form>
  );
}
