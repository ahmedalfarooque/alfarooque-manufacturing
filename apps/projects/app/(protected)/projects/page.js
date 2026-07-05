'use client';

import { useEffect, useState, useCallback } from 'react';
import Shell from '@/components/Shell';

const STATUS_BADGE = {
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'On Hold': 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const EMPTY_FORM = { customer_name: '', company_name: '', project_name: '', value: '', start_date: '', end_date: '', status: 'Upcoming', progress: 0 };

export default function ProjectsPage() {
  const [me, setMe] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const isAdmin = me?.role === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ search, status, page: String(page), pageSize: String(pageSize) });
    try {
      const res = await fetch('/projects/api/projects?' + q.toString(), { credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRows(data.projects); setTotal(data.total); setError(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [search, status, page]);

  useEffect(() => {
    fetch('/projects/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  async function saveProject(form, mode, id) {
    const url = mode === 'add' ? '/projects/api/projects' : `/projects/api/projects/${id}`;
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

  async function deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const res = await fetch(`/projects/api/projects/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
  }

  function exportExcel() { window.location.href = '/projects/api/projects/export'; }

  async function exportPdf() {
    const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('AL FAROOQUE — Projects', 14, 14);
    doc.autoTable({
      startY: 20,
      head: [['#', 'Customer', 'Company', 'Project', 'Value', 'Status', 'Progress']],
      body: rows.map((p, i) => [i + 1, p.customer_name, p.company_name || '—', p.project_name, '$' + Number(p.value).toLocaleString(), p.status, p.progress + '%']),
    });
    doc.save('projects.pdf');
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Shell active="/projects">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Projects</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Projects</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white">⤓ Export Excel</button>
          <button onClick={exportPdf} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">⤓ Export PDF</button>
          {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ Add Project</button>}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder="Search projects…" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }} className="rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm">
          {['All', 'Running', 'Completed', 'Upcoming', 'On Hold'].map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10">
            <tr>
              <th className="py-3 px-4">#</th><th>Customer</th><th>Company</th><th>Project</th><th>Value</th>
              <th>Start</th><th>End</th><th>Status</th><th>Progress</th>{isAdmin && <th className="text-right px-4">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-8 text-center text-slate-400">No projects match these filters.</td></tr>
            ) : rows.map((p, i) => (
              <tr key={p.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td className="font-medium">{p.customer_name}</td>
                <td>{p.company_name || '—'}</td>
                <td>{p.project_name}</td>
                <td>${Number(p.value).toLocaleString()}</td>
                <td>{p.start_date || '—'}</td>
                <td>{p.end_date || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[p.status] || '')}>{p.status}</span></td>
                <td>
                  <div className="w-24 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: p.progress + '%' }} />
                  </div>
                  <span className="text-xs text-slate-500">{p.progress}%</span>
                </td>
                {isAdmin && (
                  <td className="text-right px-4 space-x-2">
                    <button onClick={() => setModal({ mode: 'edit', data: p })} title="Edit" className="text-brand-500">✎</button>
                    <button onClick={() => deleteProject(p.id)} title="Delete" className="text-red-500">🗑</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
        <span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0} to {(page - 1) * pageSize + rows.length} of {total} entries</span>
        <div className="flex gap-1">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">‹</button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded border border-black/10 dark:border-white/10 disabled:opacity-40">›</button>
        </div>
      </div>

      {modal && <ProjectModal modal={modal} onClose={() => setModal(null)} onSave={saveProject} />}
    </Shell>
  );
}

function ProjectModal({ modal, onClose, onSave }) {
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
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? 'Add Project' : 'Edit Project'}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer Name" value={form.customer_name} onChange={set('customer_name')} required />
          <Field label="Company Name" value={form.company_name || ''} onChange={set('company_name')} />
          <Field label="Project Name" value={form.project_name} onChange={set('project_name')} required />
          <Field label="Total Value" value={form.value ?? ''} onChange={set('value')} type="number" />
          <Field label="Start Date" value={form.start_date || ''} onChange={set('start_date')} type="date" />
          <Field label="End Date" value={form.end_date || ''} onChange={set('end_date')} type="date" />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <select value={form.status} onChange={set('status')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm">
              {['Running', 'Completed', 'Upcoming', 'On Hold'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <Field label="Progress %" value={form.progress ?? 0} onChange={set('progress')} type="number" min={0} max={100} />
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
