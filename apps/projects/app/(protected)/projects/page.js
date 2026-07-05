'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import CustomerPicker from '@/components/CustomerPicker';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';

const STATUS_BADGE = {
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'On Hold': 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const EMPTY_FORM = {
  customer_id: null, customer_name: '', company_name: '', contact_person: '', contact_email: '', contact_phone: '', address: '',
  project_name: '', short_summary: '', project_details: '', value: '', start_date: '', end_date: '', status: 'Upcoming', progress: 0,
};
const REFRESH_MS = 15000;

export default function ProjectsPage() {
  const [me, setMe] = useState(null);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [search, setSearch] = useState('');
  /* Reads ?status= from the URL on first render — this is how the
     dashboard's KPI cards (Running/Completed/Upcoming/On Hold) link
     straight into a pre-filtered list instead of landing on "All" and
     making the visitor re-select the filter they just clicked. */
  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return 'All';
    return new URLSearchParams(window.location.search).get('status') || 'All';
  });
  const [modal, setModal] = useState(null);

  const isAdmin = me?.role === 'admin';
  const url = '/api/projects?' + new URLSearchParams({ search, status, page: String(page), pageSize: String(pageSize) }).toString();
  const { data, error, refresh } = useLiveData(url, REFRESH_MS);
  const rows = data?.projects || [];
  const total = data?.total || 0;

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  async function saveProject(form, mode, id) {
    const reqUrl = mode === 'add' ? '/api/projects' : `/api/projects/${id}`;
    const res = await fetch(reqUrl, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setModal(null);
    refresh();
  }

  async function deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  function exportExcel() { window.location.href = '/api/projects/export'; }

  async function exportPdf() {
    const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('AL FAROOQUE — Projects', 14, 14);
    doc.autoTable({
      startY: 20,
      head: [['#', 'Customer', 'Company', 'Project', 'Status', 'Progress']],
      body: rows.map((p, i) => [i + 1, p.customer_name, p.company_name || '—', p.project_name, p.status, p.progress + '%']),
    });
    doc.save('projects.pdf');
  }

  function printReport() { window.print(); }

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
          <button onClick={printReport} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">🖶 Print</button>
          {isAdmin && <button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ Add Project</button>}
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder="Search projects…" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={v => { setPage(1); setStatus(v); }} options={['All', 'Running', 'Completed', 'Upcoming', 'On Hold']} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10">
            <tr>
              <th className="py-3 px-4">#</th><th>Customer</th><th>Company</th><th>Project</th>
              <th>Start</th><th>End</th><th>Status</th><th>Progress</th><th className="text-right px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="py-8 text-center text-slate-400">No projects match these filters.</td></tr>
            ) : rows.map((p, i) => (
              <tr key={p.id} className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                onClick={() => { window.location.href = '/projects/' + p.id; }}>
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td className="font-medium">{p.customer_name}</td>
                <td>{p.company_name || '—'}</td>
                <td className="max-w-[220px] truncate">{p.project_name}</td>
                <td>{p.start_date || '—'}</td>
                <td>{p.end_date || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[p.status] || '')}>{p.status}</span></td>
                <td>
                  <div className="w-24 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: p.progress + '%' }} />
                  </div>
                  <span className="text-xs text-slate-500">{p.progress}%</span>
                </td>
                <td className="text-right px-4 space-x-2" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { window.location.href = '/projects/' + p.id; }} title="View" className="text-slate-400">{'\u{1F441}'}</button>
                  {isAdmin && <button onClick={() => setModal({ mode: 'edit', data: p })} title="Edit" className="text-brand-500">✎</button>}
                  {isAdmin && <button onClick={() => deleteProject(p.id)} title="Delete" className="text-red-500">🗑</button>}
                </td>
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

export function ProjectModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...modal.data });
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
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? 'Add Project' : 'Edit Project'}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <CustomerPicker
              value={{ customer_id: form.customer_id, customer_name: form.customer_name, company_name: form.company_name }}
              onChange={patch => setForm(f => ({ ...f, ...patch }))}
            />
          </div>
          <Field label="Company Name" value={form.company_name || ''} onChange={set('company_name')} />
          <Field label="Contact Person" value={form.contact_person || ''} onChange={set('contact_person')} />
          <Field label="Contact Email" type="email" value={form.contact_email || ''} onChange={set('contact_email')} />
          <Field label="Contact Phone" value={form.contact_phone || ''} onChange={set('contact_phone')} />
          <div className="col-span-2"><Field label="Project Address" value={form.address || ''} onChange={set('address')} /></div>

          <div className="col-span-2">
            <Field label="Project Name (optional — auto-generated from details if left blank)" value={form.project_name} onChange={set('project_name')} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Short Summary (optional)</label>
            <input value={form.short_summary || ''} onChange={set('short_summary')} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Complete Project Details</label>
            <textarea value={form.project_details || ''} onChange={set('project_details')} rows={4}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>

          <Field label="Total Value (optional)" value={form.value ?? ''} onChange={set('value')} type="number" />
          <Field label="Start Date" value={form.start_date || ''} onChange={set('start_date')} type="date" />
          <Field label="End Date" value={form.end_date || ''} onChange={set('end_date')} type="date" />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Status</label>
            <Dropdown value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={['Running', 'Completed', 'Upcoming', 'On Hold']} />
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
