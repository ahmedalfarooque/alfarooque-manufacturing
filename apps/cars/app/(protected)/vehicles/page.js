'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';

const STATUS_BADGE = {
  Running: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Idle: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Stopped: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Offline: 'bg-slate-500/10 text-slate-500',
};

const EMPTY_FORM = { vehicle_number: '', name: '', type: 'Truck', fuel_type: 'Diesel', driver: '', status: 'Idle', location: '', current_km: '' };

export default function VehiclesPage() {
  const [me, setMe] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [type, setType] = useState('All');
  const [fuelType, setFuelType] = useState('All');
  const [assignment, setAssignment] = useState('All');
  const [sort, setSort] = useState('latest');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', data }
  const [importOpen, setImportOpen] = useState(false);

  const isAdmin = me?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ search, status, type, fuelType, assignment, sort, page: String(page), pageSize: String(pageSize) });
    try {
      const res = await fetch('/cars/api/cars?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVehicles(data.vehicles); setTotal(data.total); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [search, status, type, fuelType, assignment, sort, page]);

  useEffect(() => {
    fetch('/cars/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveVehicle(form, mode, id) {
    const url = mode === 'add' ? '/cars/api/cars' : `/cars/api/cars/${id}`;
    const res = await fetch(url, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setModal(null);
    load();
  }

  async function deleteVehicle(id) {
    if (!confirm('Delete this vehicle? This can be reversed by a database admin, but not from this screen.')) return;
    const res = await fetch(`/cars/api/cars/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  function exportExcel() { window.location.href = '/cars/api/cars/export'; }

  async function exportPdf() {
    const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('AL FAROOQUE — Vehicles', 14, 14);
    doc.autoTable({
      startY: 20,
      head: [['#', 'Vehicle Number', 'Name', 'Type', 'Fuel', 'Driver', 'Status', 'Location']],
      body: vehicles.map((v, i) => [i + 1, v.vehicle_number, v.name || '—', v.type, v.fuel_type, v.driver || '—', v.status, v.location || '—']),
    });
    doc.save('vehicles.pdf');
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Shell active="/vehicles">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Vehicles</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Vehicles</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <button onClick={() => setImportOpen(true)} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">⇪ Import Excel</button>}
          <button onClick={exportExcel} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white">⤓ Export Excel</button>
          <button onClick={exportPdf} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">⤓ Export PDF</button>
          {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ Add Vehicle</button>}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        <input placeholder="Search vehicles…" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Select value={status} onChange={v => { setPage(1); setStatus(v); }} options={['All', 'Running', 'Idle', 'Stopped', 'Offline']} />
        <Select value={fuelType} onChange={v => { setPage(1); setFuelType(v); }} options={['All', 'Diesel', 'Petrol', 'Electric']} />
        <Select value={assignment} onChange={v => { setPage(1); setAssignment(v); }} options={['All', 'Assigned', 'Unassigned']} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10">
            <tr>
              <th className="py-3 px-4">#</th><th>Vehicle Number</th><th>Name</th><th>Type</th><th>Fuel</th>
              <th>Driver</th><th>Status</th><th>Location</th>{isAdmin && <th className="text-right px-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : vehicles.length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400">No vehicles match these filters.</td></tr>
            ) : vehicles.map((v, i) => (
              <tr key={v.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td className="font-medium">{v.vehicle_number}</td>
                <td>{v.name || '—'}</td>
                <td>{v.type}</td>
                <td>{v.fuel_type}</td>
                <td>{v.driver || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[v.status] || '')}>{v.status}</span></td>
                <td>{v.location || '—'}</td>
                {isAdmin && (
                  <td className="text-right px-4 space-x-2">
                    <button onClick={() => setModal({ mode: 'edit', data: v })} title="Edit" className="text-brand-500">✎</button>
                    <button onClick={() => deleteVehicle(v.id)} title="Delete" className="text-red-500">🗑</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>Showing {vehicles.length ? (page - 1) * pageSize + 1 : 0} to {(page - 1) * pageSize + vehicles.length} of {total} entries</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

      {modal && <VehicleModal modal={modal} onClose={() => setModal(null)} onSave={saveVehicle} />}
      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onDone={() => { setImportOpen(false); load(); }} />}
    </Shell>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function VehicleModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState(modal.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await onSave(form, modal.mode, modal.data.id); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? 'Add Vehicle' : 'Edit Vehicle'}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Vehicle Number" value={form.vehicle_number} onChange={set('vehicle_number')} required />
          <Field label="Name" value={form.name || ''} onChange={set('name')} />
          <Field label="Type" value={form.type || ''} onChange={set('type')} />
          <Field label="Fuel Type" value={form.fuel_type || ''} onChange={set('fuel_type')} />
          <Field label="Driver" value={form.driver || ''} onChange={set('driver')} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select value={form.status} onChange={set('status')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm">
              {['Running', 'Idle', 'Stopped', 'Offline'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Current KM" value={form.current_km ?? ''} onChange={set('current_km')} type="number" />
          <Field label="Location" value={form.location || ''} onChange={set('location')} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
    </div>
  );
}

function ImportModal({ onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/cars/api/import', { method: 'POST', credentials: 'same-origin', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4">
        <h3 className="font-semibold text-lg">Import Vehicles from Excel</h3>
        <p className="text-xs text-slate-500">Upload the fleet workbook (.xlsx). Columns are auto-detected — supports both English headers and the AL FAROOQUE Arabic fleet sheet. Vehicles already in the system (matched by plate/vehicle number) are skipped, never overwritten.</p>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        {result ? (
          <div className="text-sm space-y-1">
            <div className="text-emerald-500 font-medium">Import complete.</div>
            <div>Vehicles added: {result.inserted}</div>
            <div>Vehicles skipped (already exists): {result.skippedDuplicate}</div>
            <div>Vehicles skipped (no plate number): {result.skippedEmpty}</div>
            {result.maintenance?.sheetFound && <div>Maintenance items added: {result.maintenance.inserted} (skipped {result.maintenance.skipped})</div>}
            {result.maintenanceLog?.sheetFound && <div>Service history entries added: {result.maintenanceLog.inserted} (skipped {result.maintenanceLog.skipped})</div>}
            <button onClick={onDone} className="mt-3 w-full px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
              <button disabled={busy || !file} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Importing…' : 'Import'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
