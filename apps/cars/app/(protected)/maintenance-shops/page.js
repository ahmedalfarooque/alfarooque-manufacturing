'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';

export default function MaintenanceShopsPage() {
  const [me, setMe] = useState(null);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);
  const isAdmin = me?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ search });
      const res = await fetch('/api/shops?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setShops(data.shops); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function deleteShop(id) {
    if (!confirm('Delete this shop? This can be undone by a database admin, but not from this screen.')) return;
    const res = await fetch(`/api/shops/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { alert(data.error || 'Could not delete shop.'); return; }
    load();
  }

  return (
    <Shell active="/maintenance-shops">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Maintenance Shops</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Maintenance Shops</p>
        </div>
        {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ Add Shop</button>}
      </div>

      <input placeholder="Search shops…" value={search} onChange={e => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm mb-4" />

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10">
            <tr>
              <th className="py-3 px-4">Shop Name</th><th>Contact Person</th><th>Mobile</th><th>City</th><th>VAT Number</th>
              {isAdmin && <th className="text-right px-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : shops.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">No shops added yet.</td></tr>
            ) : shops.map(s => (
              <tr key={s.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4 font-medium">{s.name}</td>
                <td>{s.contact_person || '—'}</td>
                <td>{s.mobile || '—'}</td>
                <td>{s.city || '—'}</td>
                <td>{s.vat_number || '—'}</td>
                {isAdmin && (
                  <td className="text-right px-4 space-x-2">
                    <button onClick={() => setModal({ mode: 'edit', data: s })} title="Edit" className="text-brand-500">✎</button>
                    <button onClick={() => deleteShop(s.id)} title="Delete" className="text-red-500">🗑</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && <ShopModal modal={modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </Shell>
  );
}

export const EMPTY_FORM = { name: '', contact_person: '', mobile: '', telephone: '', email: '', address: '', city: '', vat_number: '', cr_number: '', notes: '' };

export function ShopModal({ modal, onClose, onSaved }) {
  const [form, setForm] = useState(modal.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const url = modal.mode === 'add' ? '/api/shops' : `/api/shops/${modal.data.id}`;
      const res = await fetch(url, {
        method: modal.mode === 'add' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.shop);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 my-8">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? 'Add Shop' : 'Edit Shop'}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Shop Name" value={form.name} onChange={set('name')} required className="col-span-2" />
          <Field label="Contact Person" value={form.contact_person} onChange={set('contact_person')} />
          <Field label="Mobile" value={form.mobile} onChange={set('mobile')} />
          <Field label="Telephone" value={form.telephone} onChange={set('telephone')} />
          <Field label="Email" value={form.email} onChange={set('email')} type="email" />
          <Field label="Address" value={form.address} onChange={set('address')} className="col-span-2" />
          <Field label="City" value={form.city} onChange={set('city')} />
          <Field label="VAT Number" value={form.vat_number} onChange={set('vat_number')} />
          <Field label="CR Number" value={form.cr_number} onChange={set('cr_number')} />
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Notes</label>
            <textarea value={form.notes || ''} onChange={set('notes')} rows={2} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, className, ...props }) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} value={props.value || ''} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
    </div>
  );
}
