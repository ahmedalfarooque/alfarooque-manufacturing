'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import CustomerPicker from '@/components/CustomerPicker';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';

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
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
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
  const url = '/api/projects?' + new URLSearchParams({ search: debouncedSearch, status, page: String(page), pageSize: String(pageSize) }).toString();
  const { data, error, refresh } = useLiveData(url, REFRESH_MS);
  const rawRows = data?.projects || [];
  const total = data?.total || 0;
  const { sorted: rows, sortKey, sortDir, toggleSort } = useSortableData(rawRows, { progress: p => Number(p.progress || 0) });

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch]);

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
        <input placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={v => { setPage(1); setStatus(v); }} options={['All', 'Running', 'Completed', 'Upcoming', 'On Hold']} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[950px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">#</th>
              <th onClick={() => toggleSort('customer_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Customer<SortIndicator column="customer_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('company_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Company<SortIndicator column="company_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('project_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Project<SortIndicator column="project_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>Assigned Users</th>
              <th onClick={() => toggleSort('start_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Start<SortIndicator column="start_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('end_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">End<SortIndicator column="end_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Status<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('progress')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Progress<SortIndicator column="progress" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={10} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={10} className="py-8 text-center text-slate-400">No projects match these filters.</td></tr>
            ) : rows.map((p, i) => (
              <tr key={p.id} className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                onClick={() => { window.location.href = '/projects/' + p.id; }}>
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td className="font-medium">{p.customer_name}</td>
                <td>{p.company_name || '—'}</td>
                <td className="max-w-[220px] truncate">{p.project_name}</td>
                <td><AssigneeChips assignees={p.assignees} /></td>
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

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>Showing {rows.length ? (page - 1) * pageSize + 1 : 0} to {(page - 1) * pageSize + rows.length} of {total} entries</span>
          <div className="flex items-center gap-1.5">
            <span>Rows:</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
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

function AssigneeChips({ assignees }) {
  if (!assignees || assignees.length === 0) return <span className="text-slate-400 text-xs">—</span>;
  const shown = assignees.slice(0, 3);
  const extra = assignees.length - shown.length;
  return (
    <div className="text-xs truncate max-w-[180px]" title={assignees.map(a => a.full_name).join(', ')}>
      {shown.map(a => a.full_name).join(', ')}{extra > 0 ? `, +${extra}` : ''}
    </div>
  );
}

export function ProjectModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...modal.data });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [allUsers, setAllUsers] = useState([]);
  const [assigneeIds, setAssigneeIds] = useState(new Set());
  const [initialAssigneeIds, setInitialAssigneeIds] = useState(new Set());
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserInfo, setNewUserInfo] = useState(null);

  useEffect(() => {
    fetch('/api/users', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setAllUsers(d.users || []));
  }, []);
  useEffect(() => {
    if (modal.mode !== 'edit' || !modal.data.id) return;
    fetch(`/api/projects/${modal.data.id}/assignees`, { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d) return;
      const ids = new Set((d.assignees || []).map(u => u.id));
      setAssigneeIds(ids);
      setInitialAssigneeIds(ids);
    });
  }, [modal.mode, modal.data.id]);

  function toggleAssignee(id) {
    setAssigneeIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submitNewUser(userForm) {
    const res = await fetch('/api/users', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(userForm),
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error);
    setAllUsers(prev => [...prev, d.user].sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '')));
    setAssigneeIds(prev => new Set([...prev, d.user.id]));
    setNewUserInfo({ name: d.user.full_name, email: d.user.email, password: d.temp_password });
    setAddUserOpen(false);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const saved = await onSave(form, modal.mode, modal.data.id);
      const projectId = modal.data.id || saved?.id;
      if (projectId) {
        const toAdd = [...assigneeIds].filter(id => !initialAssigneeIds.has(id));
        const toRemove = [...initialAssigneeIds].filter(id => !assigneeIds.has(id));
        await Promise.all([
          ...toAdd.map(id => fetch(`/api/projects/${projectId}/assignees`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ user_id: id }),
          })),
          ...toRemove.map(id => fetch(`/api/projects/${projectId}/assignees/${id}`, { method: 'DELETE', credentials: 'same-origin' })),
        ]);
      }
    }
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

        <div className="pt-2 border-t border-black/5 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold">Assigned Users</h4>
            <button type="button" onClick={() => setAddUserOpen(true)} className="text-xs px-3 py-1.5 rounded-lg bg-brand-500 text-white">+ Add User</button>
          </div>
          {newUserInfo && (
            <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1">
              <div className="font-medium text-emerald-600 dark:text-emerald-400">
                User "{newUserInfo.name}" created — share this temporary password (shown only once):
              </div>
              <div className="font-mono text-sm select-all">{newUserInfo.email} / {newUserInfo.password}</div>
              <button type="button" onClick={() => setNewUserInfo(null)} className="text-slate-500 underline">Dismiss</button>
            </div>
          )}
          <div className="rounded-lg border border-black/10 dark:border-white/10 max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-slate-400 sticky top-0 bg-white dark:bg-[#0f172a]">
                <tr>
                  <th className="py-2 px-3 w-8"></th>
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-3">Position</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.length === 0 ? (
                  <tr><td colSpan={4} className="py-4 text-center text-slate-400">No users yet — click "+ Add User".</td></tr>
                ) : allUsers.map(u => (
                  <tr key={u.id} className="border-t border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02]" onClick={() => toggleAssignee(u.id)}>
                    <td className="px-3"><input type="checkbox" checked={assigneeIds.has(u.id)} onChange={() => toggleAssignee(u.id)} onClick={e => e.stopPropagation()} /></td>
                    <td className="py-2 px-3 font-medium">{u.full_name}{u.role === 'admin' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">Admin</span>}</td>
                    <td>{u.email}</td>
                    <td>{u.position || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
      {addUserOpen && <AddUserModal onClose={() => setAddUserOpen(false)} onSave={submitNewUser} />}
    </div>
  );
}

function AddUserModal({ onClose, onSave }) {
  const [form, setForm] = useState({ full_name: '', email: '', position: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await onSave(form); }
    catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-3">
        <h3 className="font-semibold text-lg">Add User</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <Field label="Full Name" value={form.full_name} onChange={set('full_name')} required autoFocus />
        <Field label="Email" type="email" value={form.email} onChange={set('email')} required />
        <Field label="Position" value={form.position} onChange={set('position')} placeholder="e.g. Project Engineer" />
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
