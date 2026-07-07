'use client';

import { useEffect, useMemo, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';

const STATUS_BADGE = {
  Pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Approved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  Ordered: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Delivered: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};
const PRIORITY_BADGE = {
  Normal: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  Urgent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const STATUS_ACTIONS = [
  { to: 'Approved', label: 'Accept' },
  { to: 'Rejected', label: 'Reject' },
  { to: 'Ordered', label: 'Mark Ordered' },
  { to: 'Delivered', label: 'Mark Delivered' },
  { to: 'Completed', label: 'Mark Completed' },
];

const REFRESH_MS = 15000;

export default function PurchaseRequestsPage() {
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [status, setStatus] = useState(() => {
    if (typeof window === 'undefined') return 'All';
    return new URLSearchParams(window.location.search).get('status') || 'All';
  });
  const [priority, setPriority] = useState('All');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [viewId, setViewId] = useState(null);

  const isAdmin = me?.role === 'admin';
  const { data, error, refresh } = useLiveData('/api/purchase-requests', REFRESH_MS);
  const allRows = data?.purchaseRequests || [];

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return allRows.filter(r => {
      if (status !== 'All' && r.status !== status) return false;
      if (priority !== 'All' && r.priority !== priority) return false;
      if (!q) return true;
      return [r.material_description, r.project_name, r.customer_name, r.requested_by_name, r.supplier]
        .filter(Boolean).some(s => s.toLowerCase().includes(q));
    });
  }, [allRows, status, priority, debouncedSearch]);

  const { sorted: rows, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);
  useEffect(() => { setPage(1); }, [debouncedSearch, status, priority]);

  async function setRequestStatus(id, newStatus) {
    await fetch(`/api/purchase-requests/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status: newStatus }),
    });
    refresh();
  }

  async function deleteRequest(id) {
    if (!confirm('Delete this purchase request? This cannot be undone.')) return;
    const res = await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
  }

  function exportExcel() {
    const header = ['Date', 'Project', 'Customer', 'Materials', 'Priority', 'Requested By', 'Status'];
    const lines = [header.join(',')].concat(rows.map(r => [
      r.request_date, r.project_name, r.customer_name, `"${(r.material_description || '').replace(/"/g, '""')}"`,
      r.priority, r.requested_by_name, r.status,
    ].join(',')));
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'purchase-requests.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPdf() {
    const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);
    await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.text('AL FAROOQUE — Purchase Requests', 14, 14);
    doc.autoTable({
      startY: 20,
      head: [['#', 'Date', 'Project', 'Materials', 'Priority', 'Requested By', 'Status']],
      body: rows.map((r, i) => [i + 1, r.request_date, r.project_name, r.material_description, r.priority, r.requested_by_name, r.status]),
    });
    doc.save('purchase-requests.pdf');
  }

  function printReport() { window.print(); }

  if (!isAdmin && me) return <Shell active="/purchase-requests"><div className="text-red-500 text-sm">Only admins can view this page.</div></Shell>;

  return (
    <Shell active="/purchase-requests">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Purchase Requests</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Purchase Requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="text-sm px-3 py-2 rounded-lg bg-emerald-600 text-white">⤓ Export Excel</button>
          <button onClick={exportPdf} className="text-sm px-3 py-2 rounded-lg bg-red-600 text-white">⤓ Export PDF</button>
          <button onClick={printReport} className="text-sm px-3 py-2 rounded-lg border border-black/10 dark:border-white/10">🖶 Print</button>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
        <input placeholder="Search purchase requests…" value={search} onChange={e => setSearch(e.target.value)}
          className="col-span-2 rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
        <Dropdown value={status} onChange={setStatus} options={['All', 'Pending', 'Approved', 'Rejected', 'Ordered', 'Delivered', 'Completed']} />
        <Dropdown value={priority} onChange={setPriority} options={['All', 'Normal', 'Urgent', 'Critical']} />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[1000px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">#</th>
              <th onClick={() => toggleSort('request_date')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Date<SortIndicator column="request_date" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('project_name')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Project<SortIndicator column="project_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>Materials</th>
              <th onClick={() => toggleSort('priority')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Priority<SortIndicator column="priority" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>Requested By</th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">Status<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : pageRows.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">No purchase requests match these filters.</td></tr>
            ) : pageRows.map((r, i) => (
              <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{(page - 1) * pageSize + i + 1}</td>
                <td>{r.request_date}</td>
                <td className="max-w-[160px] truncate">{r.project_name}</td>
                <td className="max-w-[220px] truncate">{r.material_description}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PRIORITY_BADGE[r.priority] || '')}>{r.priority}</span></td>
                <td>{r.requested_by_name || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[r.status] || '')}>{r.status}</span></td>
                <td className="text-right px-4 space-x-2 whitespace-nowrap">
                  <button onClick={() => setViewId(r.id)} title="View" className="text-slate-400">{'\u{1F441}'}</button>
                  <a href={'/projects/' + r.project_id + '?tab=purchase-requests'} title="Open Project" className="text-brand-500">↗</a>
                  <button onClick={() => deleteRequest(r.id)} title="Delete" className="text-red-500">🗑</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>Showing {pageRows.length ? (page - 1) * pageSize + 1 : 0} to {(page - 1) * pageSize + pageRows.length} of {total} entries</span>
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

      {viewId && (
        <ViewModal id={viewId} onClose={() => setViewId(null)} onAction={async (status) => { await setRequestStatus(viewId, status); }} />
      )}
    </Shell>
  );
}

function ViewModal({ id, onClose, onAction }) {
  const { data, refresh } = useLiveData(`/api/purchase-requests/${id}`, 0);
  const r = data?.purchaseRequest;
  const attachments = data?.attachments || [];
  const [busy, setBusy] = useState(false);

  async function act(status) {
    setBusy(true);
    try { await onAction(status); refresh(); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {!r ? <div className="text-slate-400 text-sm">Loading…</div> : (
          <>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg">{r.project_name}</h3>
              <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (STATUS_BADGE[r.status] || '')}>{r.status}</span>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Date" value={r.request_date} />
              <Row label="Requested By" value={r.requested_by_name} />
              <Row label="Supplier" value={r.supplier} />
              <Row label="Priority" value={r.priority} />
              <Row label="Quantity" value={r.quantity ? `${r.quantity} ${r.unit || ''}` : null} />
              <Row label="Estimated Price" value={r.estimated_price ? `SAR ${Number(r.estimated_price).toLocaleString()}` : null} />
              <Row label="Required Date" value={r.required_date} />
            </dl>
            <div>
              <div className="text-xs text-slate-500 mb-1">Material Description</div>
              <p className="text-sm whitespace-pre-wrap">{r.material_description}</p>
            </div>
            {attachments.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Attachments</div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map(a => <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg border border-black/10 dark:border-white/10">📎 {a.file_name}</a>)}
                </div>
              </div>
            )}
            <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap gap-2">
              {STATUS_ACTIONS.filter(a => a.to !== r.status).map(a => (
                <button key={a.to} disabled={busy} onClick={() => act(a.to)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-brand-500/40">{a.label}</button>
              ))}
            </div>
            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
