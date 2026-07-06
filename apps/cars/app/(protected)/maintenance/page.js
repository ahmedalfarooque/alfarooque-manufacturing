'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { ShopModal, EMPTY_FORM as EMPTY_SHOP_FORM } from '@/app/(protected)/maintenance-shops/page';

const PAYMENT_BADGE = {
  Paid: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Unpaid: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export const EMPTY_FORM = {
  car_id: '', driver_id: '', maintenance_date: new Date().toISOString().slice(0, 10), category: '', maintenance_type: '',
  shop_id: '', odometer_km: '', amount: '', currency: 'SAR', invoice_number: '', payment_status: 'Unpaid',
  technician: '', warranty: '', work_performed: '', parts_changed: '', labor_details: '', notes: '',
};

export default function MaintenanceRecordsPage() {
  const [me, setMe] = useState(null);
  const [records, setRecords] = useState([]);
  const [cars, setCars] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [shops, setShops] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [search, setSearch] = useState('');
  const [carId, setCarId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [shopId, setShopId] = useState('');
  const [category, setCategory] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [costMin, setCostMin] = useState('');
  const [costMax, setCostMax] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const isAdmin = me?.role === 'admin';

  const loadRefs = useCallback(() => {
    fetch('/api/cars?pageSize=100', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setCars(d.vehicles || [])).catch(() => {});
    fetch('/api/drivers', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setDrivers(d.drivers || [])).catch(() => {});
    fetch('/api/shops', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setShops(d.shops || [])).catch(() => {});
    fetch('/api/categories', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setCategories(d.categories || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({
      search, carId, driverId, shopId, category, paymentStatus, dateFrom, dateTo, costMin, costMax,
      page: String(page), pageSize: String(pageSize),
    });
    try {
      const res = await fetch('/api/maintenance-records?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRecords(data.records); setTotal(data.total); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [search, carId, driverId, shopId, category, paymentStatus, dateFrom, dateTo, costMin, costMax, page]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    loadRefs();
  }, [loadRefs]);
  useEffect(() => { load(); }, [load]);

  async function deleteRecord(id) {
    if (!confirm('Delete this maintenance record and all its attachments? This cannot be undone.')) return;
    const res = await fetch(`/api/maintenance-records/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Shell active="/maintenance">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Maintenance</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Maintenance</p>
        </div>
        {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ Add Maintenance Record</button>}
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder="Search invoice, type, technician…" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={carId} onChange={v => { setPage(1); setCarId(v); }} placeholder="All Vehicles" options={cars.map(c => [c.id, c.vehicle_number])} />
        <Dropdown value={driverId} onChange={v => { setPage(1); setDriverId(v); }} placeholder="All Drivers" options={drivers.map(d => [d.id, d.full_name])} />
        <Dropdown value={shopId} onChange={v => { setPage(1); setShopId(v); }} placeholder="All Shops" options={shops.map(s => [s.id, s.name])} />
        <Dropdown value={category} onChange={v => { setPage(1); setCategory(v); }} placeholder="All Categories" options={categories.map(c => [c.name, c.name])} />
        <Dropdown value={paymentStatus} onChange={v => { setPage(1); setPaymentStatus(v); }} placeholder="All Payment Status" options={[['Paid', 'Paid'], ['Unpaid', 'Unpaid'], ['Partial', 'Partial']]} />
        <div className="flex items-center gap-1">
          <input type="date" value={dateFrom} onChange={e => { setPage(1); setDateFrom(e.target.value); }} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-xs" />
          <span className="text-slate-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={e => { setPage(1); setDateTo(e.target.value); }} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-xs" />
        </div>
        <div className="flex items-center gap-1">
          <input type="number" placeholder="Min cost" value={costMin} onChange={e => { setPage(1); setCostMin(e.target.value); }} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-xs" />
          <span className="text-slate-400 text-xs">–</span>
          <input type="number" placeholder="Max cost" value={costMax} onChange={e => { setPage(1); setCostMax(e.target.value); }} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-2 py-2 text-xs" />
        </div>
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-16 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">Date</th><th>Vehicle</th><th>Driver</th><th>Category</th><th>Shop</th>
              <th>Amount</th><th>KM</th><th>Invoice</th><th>Status</th><th>Created By</th><th className="text-right px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={11} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={11} className="py-8 text-center text-slate-400">No maintenance records match these filters.</td></tr>
            ) : records.map(r => (
              <tr key={r.id} className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                onClick={() => { window.location.href = '/maintenance/' + r.id; }}>
                <td className="py-3 px-4">{r.maintenance_date}</td>
                <td className="font-medium">{r.cars?.vehicle_number || '—'}</td>
                <td>{r.drivers?.full_name || '—'}</td>
                <td>{r.category}</td>
                <td>{r.maintenance_shops?.name || '—'}</td>
                <td>{r.currency} {fmt(r.amount)}</td>
                <td>{r.odometer_km ? fmt(r.odometer_km) : '—'}</td>
                <td>{r.invoice_number || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PAYMENT_BADGE[r.payment_status] || '')}>{r.payment_status}</span></td>
                <td>{r.platform_users?.full_name || r.platform_users?.email || '—'}</td>
                <td className="text-right px-4 space-x-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { window.location.href = '/maintenance/' + r.id; }} title="View" className="text-slate-400">{'\u{1F441}'}</button>
                  {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: r })} title="Edit" className="text-brand-500">✎</button>}
                  {isAdmin && <button onClick={() => deleteRecord(r.id)} title="Delete" className="text-red-500">🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>Showing {records.length ? (page - 1) * pageSize + 1 : 0} to {(page - 1) * pageSize + records.length} of {total} entries</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

      {modal && (
        <RecordModal modal={modal} cars={cars} drivers={drivers} shops={shops} categories={categories}
          onShopAdded={s => setShops(prev => [...prev, s].sort((a, b) => a.name.localeCompare(b.name)))}
          onClose={() => setModal(null)}
          onSaved={id => { setModal(null); load(); if (modal.mode === 'add' && id) window.location.href = '/maintenance/' + id; }} />
      )}
    </Shell>
  );
}

export function RecordModal({ modal, cars, drivers, shops, categories, onShopAdded, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...modal.data }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [addShopOpen, setAddShopOpen] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const url = modal.mode === 'add' ? '/api/maintenance-records' : `/api/maintenance-records/${modal.data.id}`;
      const res = await fetch(url, {
        method: modal.mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.record?.id);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-3xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 my-8">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? 'Add Maintenance Record' : 'Edit Maintenance Record'}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Basic Information</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Vehicle</label>
            <Dropdown value={form.car_id} onChange={v => setForm(f => ({ ...f, car_id: v }))} placeholder="Select vehicle…"
              options={cars.map(c => [c.id, c.vehicle_number])} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Driver</label>
            <Dropdown value={form.driver_id || ''} onChange={v => setForm(f => ({ ...f, driver_id: v }))} placeholder="— None —"
              options={[['', '— None —'], ...drivers.map(d => [d.id, d.full_name])]} />
          </div>
          <Field label="Maintenance Date" type="date" value={form.maintenance_date} onChange={set('maintenance_date')} required />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Category</label>
            <Dropdown value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} placeholder="Select category…"
              options={categories.map(c => [c.name, c.name])} />
          </div>
          <Field label="Maintenance Type" value={form.maintenance_type} onChange={set('maintenance_type')} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Workshop / Shop</label>
            <div className="flex gap-1">
              <Dropdown className="flex-1" value={form.shop_id || ''} onChange={v => setForm(f => ({ ...f, shop_id: v }))} placeholder="— None —"
                options={[['', '— None —'], ...shops.map(s => [s.id, s.name])]} />
              <button type="button" onClick={() => setAddShopOpen(true)} title="Add New Shop" className="px-2 rounded-lg border border-black/10 dark:border-white/10 text-sm shrink-0">+</button>
            </div>
          </div>
          <Field label="Odometer (KM)" type="number" value={form.odometer_km} onChange={set('odometer_km')} />
          <Field label="Amount" type="number" value={form.amount} onChange={set('amount')} />
          <Field label="Currency" value={form.currency} onChange={set('currency')} />
          <Field label="Invoice Number" value={form.invoice_number} onChange={set('invoice_number')} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Payment Status</label>
            <Dropdown value={form.payment_status} onChange={v => setForm(f => ({ ...f, payment_status: v }))} options={['Unpaid', 'Paid', 'Partial']} />
          </div>
          <Field label="Technician" value={form.technician} onChange={set('technician')} />
          <Field label="Warranty" value={form.warranty} onChange={set('warranty')} />
        </div>

        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-2">Maintenance Details</div>
        <div className="grid gap-3">
          <TextArea label="Work Performed" value={form.work_performed} onChange={set('work_performed')} />
          <TextArea label="Parts Changed" value={form.parts_changed} onChange={set('parts_changed')} />
          <TextArea label="Labor Details" value={form.labor_details} onChange={set('labor_details')} />
          <TextArea label="Additional Notes" value={form.notes} onChange={set('notes')} />
        </div>
        {modal.mode === 'add' && <p className="text-xs text-slate-500">Attachments (invoice, photos, documents) can be added from the record's detail page after saving.</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>

      {addShopOpen && (
        <ShopModal modal={{ mode: 'add', data: EMPTY_SHOP_FORM }} onClose={() => setAddShopOpen(false)}
          onSaved={shop => { onShopAdded(shop); setForm(f => ({ ...f, shop_id: shop.id })); setAddShopOpen(false); }} />
      )}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} value={props.value ?? ''} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
    </div>
  );
}
function TextArea({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <textarea {...props} value={props.value || ''} rows={2} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
    </div>
  );
}
function fmt(n) { return Number(n || 0).toLocaleString(); }
