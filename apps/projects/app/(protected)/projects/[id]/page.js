'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { ProjectModal } from '@/app/(protected)/projects/page';

const STATUS_BADGE = {
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'On Hold': 'bg-red-500/10 text-red-600 dark:text-red-400',
};

const PR_STATUS_BADGE = {
  Pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Under Review': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  Approved: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  'On Hold': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Purchased: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Delivered: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Cancelled: 'bg-slate-500/10 text-slate-500',
  'Payment Pending': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Payment Approved': 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Payment Completed': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Ordered: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};
const PR_PRIORITY_BADGE = {
  Normal: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  Urgent: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Critical: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const DU_STATUS_BADGE = {
  Pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Approved: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Rejected: 'bg-red-500/10 text-red-600 dark:text-red-400',
  'Need Revision': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  Published: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
};
const DU_REVIEW_ACTIONS = [
  { to: 'Approved', label: 'Approve' },
  { to: 'Rejected', label: 'Reject' },
  { to: 'Need Revision', label: 'Need Revision' },
  { to: 'Published', label: 'Publish' },
];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'purchase-requests', label: 'Purchase Requests' },
  { key: 'daily-updates', label: 'Daily Updates' },
  { key: 'documents', label: 'Documents' },
  { key: 'assigned-people', label: 'Assigned People' },
  { key: 'activity', label: 'Activity' },
];

export default function ProjectViewPage() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [tab, setTab] = useState(() => {
    if (typeof window === 'undefined') return 'overview';
    const t = new URLSearchParams(window.location.search).get('tab');
    return TABS.some(x => x.key === t) ? t : 'overview';
  });

  const { data, error, refresh } = useLiveData('/api/projects/' + id, 15000);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  function selectTab(key) {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', key);
    window.history.replaceState({}, '', url);
  }

  async function saveProject(form, mode, projectId) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setEditOpen(false);
    refresh();
    return respData.project;
  }

  if (error) return <Shell active="/projects"><div className="text-red-500">{error}</div></Shell>;
  if (!data) return <Shell active="/projects"><div className="text-slate-400">Loading…</div></Shell>;

  const { project: p, customer: c, documents, assignees } = data;
  const hasValue = p.value != null && Number(p.value) > 0;
  const isAssignedUser = (assignees || []).some(a => a.id === me?.id);
  const canCreate = isAdmin || isAssignedUser;

  return (
    <Shell active="/projects">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <a href="/projects" className="text-xs text-brand-500 hover:underline">← Back to Projects</a>
          <h2 className="text-lg font-semibold mt-1">{p.project_name}</h2>
          <p className="text-xs text-slate-500">Dashboard &gt; Projects &gt; {p.project_name}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (STATUS_BADGE[p.status] || '')}>{p.status}</span>
          {isAdmin && <button onClick={() => setEditOpen(true)} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">✎ Edit</button>}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-black/5 dark:border-white/10 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => selectTab(t.key)}
            className={'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ' +
              (tab === t.key ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab p={p} c={c} hasValue={hasValue} assignees={assignees || []} />}
      {tab === 'purchase-requests' && <PurchaseRequestsTab projectId={id} canCreate={canCreate} isAdmin={isAdmin} />}
      {tab === 'daily-updates' && <DailyUpdatesTab projectId={id} canCreate={canCreate} isAdmin={isAdmin} meId={me?.id} />}
      {tab === 'documents' && <DocumentsTab projectId={id} documents={documents} isAdmin={isAdmin} refresh={refresh} />}
      {tab === 'assigned-people' && <AssignedPeopleTab assignees={assignees || []} isAdmin={isAdmin} onEdit={() => setEditOpen(true)} />}
      {tab === 'activity' && <ActivityTab projectId={id} />}

      {editOpen && <ProjectModal modal={{ mode: 'edit', data: p }} onClose={() => setEditOpen(false)} onSave={saveProject} />}
    </Shell>
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

function Avatar({ name }) {
  const initials = (name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join('');
  return (
    <div className="w-9 h-9 rounded-full bg-brand-500/15 text-brand-600 dark:text-brand-400 flex items-center justify-center text-xs font-semibold shrink-0">
      {initials || '?'}
    </div>
  );
}

/* ══════════════════════════════ OVERVIEW ══════════════════════════════ */

function OverviewTab({ p, c, hasValue, assignees }) {
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Customer Information</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Name" value={c?.full_name || p.customer_name} />
            <Row label="Company" value={c?.company_name || p.company_name} />
            <Row label="Contact Person" value={p.contact_person} />
            <Row label="Email" value={c?.email || p.contact_email} />
            <Row label="Phone" value={c?.mobile_number || p.contact_phone} />
            <Row label="VAT Number" value={c?.vat_number} />
            <Row label="CR Number" value={c?.cr_number} />
            <Row label="Address" value={p.address || c?.address} />
          </dl>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">Project Information</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Project Name" value={p.project_name} />
            <Row label="Short Summary" value={p.short_summary} />
            <Row label="Status" value={p.status} />
            <Row label="Progress" value={p.progress + '%'} />
            <Row label="Start Date" value={p.start_date} />
            <Row label="End Date" value={p.end_date} />
            {hasValue && <Row label="Project Value" value={'$' + Number(p.value).toLocaleString()} />}
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
        <h3 className="font-medium text-sm mb-3">Complete Project Details</h3>
        <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{p.project_details || 'No additional details.'}</p>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
        <h3 className="font-medium text-sm mb-3">Assigned Users</h3>
        {assignees.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">No users assigned to this project yet.</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignees.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/10 p-3">
                <Avatar name={u.full_name} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{u.full_name}{u.role === 'admin' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">Admin</span>}</div>
                  <div className="text-xs text-slate-500 truncate">{u.position || '—'}</div>
                  <div className="text-xs text-slate-400 truncate">{u.email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/* ══════════════════════════════ ASSIGNED PEOPLE ══════════════════════════════ */

function AssignedPeopleTab({ assignees, isAdmin, onEdit }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Assigned People</h3>
        {isAdmin && <button onClick={onEdit} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">✎ Manage Assignees</button>}
      </div>
      {assignees.length === 0 ? (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          No users assigned to this project yet.
        </div>
      ) : (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[65vh]">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th>Position</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Department</th>
                <th>Assigned Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {assignees.map(u => (
                <tr key={u.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.full_name} />
                      <span className="font-medium">{u.full_name}</span>
                      {u.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">Admin</span>}
                    </div>
                  </td>
                  <td>{u.position || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{u.department || '—'}</td>
                  <td>{u.assigned_at ? new Date(u.assigned_at).toLocaleDateString() : '—'}</td>
                  <td><span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{u.status || 'Active'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════ DOCUMENTS ══════════════════════════════ */

function DocumentsTab({ projectId, documents, isAdmin, refresh }) {
  const [lightbox, setLightbox] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true); setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/projects/${projectId}/documents`, { method: 'POST', credentials: 'same-origin', body: fd });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error);
      refresh();
    } catch (err) {
      setUploadErr(err.message);
    }
    setUploadBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function deleteFile(docId) {
    if (!confirm('Delete this file? This cannot be undone.')) return;
    const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setLightbox(null); refresh(); }
  }

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Images &amp; Documents</h3>
        {isAdmin && (
          <label className="text-sm px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 cursor-pointer">
            {uploadBusy ? 'Uploading…' : '⇪ Upload'}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" disabled={uploadBusy} onChange={uploadFile} />
          </label>
        )}
      </div>
      {uploadErr && <div className="text-red-500 text-sm mb-2">{uploadErr}</div>}
      {documents.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">No images or documents uploaded yet.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {documents.map(d => {
            const isImage = /\.(jpe?g|png|gif|webp)$/i.test(d.file_name);
            return (
              <div key={d.id} className="relative group">
                <button type="button" onClick={() => isImage && setLightbox(d)}
                  className="aspect-square w-full rounded-lg border border-black/10 dark:border-white/10 overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  {isImage ? (
                    <img src={d.url} alt={d.file_name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-center p-2 text-slate-500">📄<br />{d.file_name}</a>
                  )}
                </button>
                {isAdmin && (
                  <button type="button" onClick={() => deleteFile(d.id)} title="Delete"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/70 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    🗑
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.file_name} className="max-w-full max-h-full rounded-lg" />
            <div className="absolute top-2 right-2 flex gap-2">
              {isAdmin && <button onClick={() => deleteFile(lightbox.id)} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm">🗑 Delete</button>}
              <button onClick={() => setLightbox(null)} className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-sm">✕ Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ PURCHASE REQUESTS ══════════════════════════ */

function PurchaseRequestsTab({ projectId, canCreate, isAdmin }) {
  const [modal, setModal] = useState(null); // 'new' | {id}
  const { data, error, refresh } = useLiveData(`/api/projects/${projectId}/purchase-requests`, 15000);
  const rows = data?.purchaseRequests || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Purchase Requests</h3>
        {canCreate && <button onClick={() => setModal('new')} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ New Purchase Request</button>}
      </div>
      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[60vh]">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th>Materials</th>
              <th>Priority</th>
              <th>Requested By</th>
              <th>Status</th>
              <th className="text-right px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">No purchase requests yet.</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{r.request_date}</td>
                <td className="max-w-[220px] truncate">{r.material_description}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_PRIORITY_BADGE[r.priority] || '')}>{r.priority}</span></td>
                <td>{r.requested_by_name || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_STATUS_BADGE[r.status] || '')}>{r.status}</span></td>
                <td className="text-right px-4"><button onClick={() => setModal({ id: r.id })} className="text-slate-400" title="View">{'\u{1F441}'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal === 'new' && <PurchaseRequestModal projectId={projectId} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal && modal !== 'new' && <PurchaseRequestDetailModal id={modal.id} isAdmin={isAdmin} onClose={() => setModal(null)} onChanged={refresh} />}
    </div>
  );
}

function PurchaseRequestModal({ projectId, onClose, onSaved }) {
  const [form, setForm] = useState({
    request_date: new Date().toISOString().slice(0, 10), supplier: '', material_description: '', material_list: '',
    quantity: '', unit: '', estimated_price: '', required_date: '', priority: 'Normal', remarks: '',
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    if (f.size > 20 * 1024 * 1024) { setErr('File is too large (max 20MB).'); e.target.value = ''; return; }
    setErr(null);
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/purchase-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form),
      });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error);

      if (file) {
        const prId = respData.purchaseRequest.id;
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/purchase-requests/${prId}/attachments`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = ev => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Attachment upload failed.'));
          xhr.onerror = () => reject(new Error('Attachment upload failed.'));
          const fd = new FormData();
          fd.append('file', file);
          xhr.send(fd);
        });
      }
      onSaved();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">New Purchase Request</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={form.request_date} onChange={set('request_date')} />
          <Field label="Supplier (optional)" value={form.supplier} onChange={set('supplier')} />
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Material Description</label>
            <textarea value={form.material_description} onChange={set('material_description')} rows={2} required
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Material List (optional — one item per line)</label>
            <textarea value={form.material_list} onChange={set('material_list')} rows={3}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <Field label="Quantity" type="number" value={form.quantity} onChange={set('quantity')} />
          <Field label="Unit" value={form.unit} onChange={set('unit')} placeholder="pcs, kg, m…" />
          <Field label="Estimated Price (optional)" type="number" value={form.estimated_price} onChange={set('estimated_price')} />
          <Field label="Required Date" type="date" value={form.required_date} onChange={set('required_date')} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">Priority</label>
            <Dropdown value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} options={['Normal', 'Urgent', 'Critical']} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Remarks (optional)</label>
            <textarea value={form.remarks} onChange={set('remarks')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Attachment (optional — image, PDF, Excel, Word, ZIP, max 20MB)</label>
            <input type="file" accept="image/*,.pdf,.xls,.xlsx,.doc,.docx,.zip" onChange={onFileChange}
              className="w-full text-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            {busy && file && <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }} /></div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Cancel</button>
          <button disabled={busy} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm">{busy ? 'Submitting…' : 'Submit'}</button>
        </div>
      </form>
    </div>
  );
}

const PR_ACTIONS = [
  { to: 'Under Review', label: 'Under Review' },
  { to: 'Approved', label: 'Approve' },
  { to: 'Rejected', label: 'Reject' },
  { to: 'On Hold', label: 'Put On Hold' },
  { to: 'Purchased', label: 'Mark Purchased' },
  { to: 'Delivered', label: 'Mark Delivered' },
  { to: 'Payment Pending', label: 'Payment Pending' },
  { to: 'Payment Completed', label: 'Payment Completed' },
  { to: 'Cancelled', label: 'Cancel' },
];

function PurchaseRequestDetailModal({ id, isAdmin, onClose, onChanged }) {
  const { data, refresh } = useLiveData(`/api/purchase-requests/${id}`, 0);
  const [busy, setBusy] = useState(false);
  const r = data?.purchaseRequest;
  const attachments = data?.attachments || [];

  async function setStatus(status) {
    setBusy(true);
    try {
      await fetch(`/api/purchase-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status }),
      });
      refresh(); onChanged();
    } finally { setBusy(false); }
  }

  async function del() {
    if (!confirm('Delete this purchase request? This cannot be undone.')) return;
    setBusy(true);
    try {
      await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      onChanged(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {!r ? <div className="text-slate-400 text-sm">Loading…</div> : (
          <>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg">Purchase Request</h3>
              <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_STATUS_BADGE[r.status] || '')}>{r.status}</span>
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
            {r.material_list && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Material List</div>
                <p className="text-sm whitespace-pre-wrap">{r.material_list}</p>
              </div>
            )}
            {r.remarks && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Remarks</div>
                <p className="text-sm whitespace-pre-wrap">{r.remarks}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Attachments</div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map(a => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg border border-black/10 dark:border-white/10">📎 {a.file_name}</a>
                  ))}
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap gap-2">
                {PR_ACTIONS.filter(a => a.to !== r.status).map(a => (
                  <button key={a.to} disabled={busy} onClick={() => setStatus(a.to)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-brand-500/40">{a.label}</button>
                ))}
                <button disabled={busy} onClick={del} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 ml-auto">🗑 Delete</button>
              </div>
            )}
            <div className="flex justify-between items-center pt-2">
              <a href={'/purchase-requests/' + id} className="text-sm text-brand-500 hover:underline">View Full Details, History &amp; Comments →</a>
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════ DAILY UPDATES ══════════════════════════════ */

function DailyUpdatesTab({ projectId, canCreate, isAdmin, meId }) {
  const [modal, setModal] = useState(null);
  const { data, error, refresh } = useLiveData(`/api/projects/${projectId}/daily-updates`, 15000);
  const rows = data?.dailyUpdates || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">Daily Updates</h3>
        {canCreate && <button onClick={() => setModal('new')} className="text-sm px-3 py-2 rounded-lg bg-brand-500 text-white">+ New Daily Update</button>}
      </div>
      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[60vh]">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">Date</th>
              <th>User</th>
              <th>Summary</th>
              <th>Progress</th>
              <th>Status</th>
              <th className="text-right px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">No daily updates yet.</td></tr>
            ) : rows.map(u => (
              <tr key={u.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{u.update_date}</td>
                <td>{u.author_name || '—'}</td>
                <td className="max-w-[260px] truncate">{u.title || u.todays_work}</td>
                <td>{u.progress_pct != null ? `${u.progress_pct}%` : '—'}</td>
                <td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (DU_STATUS_BADGE[u.status || 'Pending'] || '')}>{u.status || 'Pending'}</span></td>
                <td className="text-right px-4"><button onClick={() => setModal({ id: u.id })} className="text-slate-400" title="View">{'\u{1F441}'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal === 'new' && <DailyUpdateModal projectId={projectId} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal && modal !== 'new' && <DailyUpdateDetailModal id={modal.id} isAdmin={isAdmin} meId={meId} onClose={() => setModal(null)} onChanged={refresh} />}
    </div>
  );
}

function DailyUpdateModal({ projectId, onClose, onSaved }) {
  const [form, setForm] = useState({
    update_date: new Date().toISOString().slice(0, 10), weather: '', progress_pct: '', todays_work: '',
    description: '', issues: '', tomorrow_plan: '', remarks: '', title: '', need_help: false,
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) { setFile(null); return; }
    if (f.size > 50 * 1024 * 1024) { setErr('File is too large (max 50MB).'); e.target.value = ''; return; }
    setErr(null);
    setFile(f);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/daily-updates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(form),
      });
      const respData = await res.json();
      if (!res.ok) throw new Error(respData.error);

      if (file) {
        const duId = respData.dailyUpdate.id;
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/daily-updates/${duId}/attachments`);
          xhr.withCredentials = true;
          xhr.upload.onprogress = ev => { if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100)); };
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error('Attachment upload failed.'));
          xhr.onerror = () => reject(new Error('Attachment upload failed.'));
          const fd = new FormData();
          fd.append('file', file);
          xhr.send(fd);
        });
      }
      onSaved();
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">New Daily Update</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Date" type="date" value={form.update_date} onChange={set('update_date')} />
          <Field label="Title (optional)" value={form.title} onChange={set('title')} />
          <Field label="Weather (optional)" value={form.weather} onChange={set('weather')} />
          <Field label="Progress %" type="number" min={0} max={100} value={form.progress_pct} onChange={set('progress_pct')} />
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.need_help} onChange={e => setForm(f => ({ ...f, need_help: e.target.checked }))} />
              I need help / this is blocked
            </label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Today's Work</label>
            <textarea value={form.todays_work} onChange={set('todays_work')} rows={2} required
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Detailed Description</label>
            <textarea value={form.description} onChange={set('description')} rows={3}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Issues (optional)</label>
            <textarea value={form.issues} onChange={set('issues')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Tomorrow Plan (optional)</label>
            <textarea value={form.tomorrow_plan} onChange={set('tomorrow_plan')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Remarks (optional)</label>
            <textarea value={form.remarks} onChange={set('remarks')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">Attachments (optional — image, PDF, video, max 50MB)</label>
            <input type="file" accept="image/*,.pdf,video/*" onChange={onFileChange}
              className="w-full text-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            {busy && file && <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }} /></div>}
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

function DailyUpdateDetailModal({ id, isAdmin, meId, onClose, onChanged }) {
  const { data, refresh } = useLiveData(`/api/daily-updates/${id}`, 0);
  const [busy, setBusy] = useState(false);
  const u = data?.dailyUpdate;
  const attachments = data?.attachments || [];
  const canDelete = isAdmin;

  async function del() {
    if (!confirm('Delete this daily update? This cannot be undone.')) return;
    setBusy(true);
    try {
      await fetch(`/api/daily-updates/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      onChanged(); onClose();
    } finally { setBusy(false); }
  }

  async function setReviewStatus(status) {
    setBusy(true);
    try {
      await fetch(`/api/daily-updates/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ status }),
      });
      refresh(); onChanged();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {!u ? <div className="text-slate-400 text-sm">Loading…</div> : (
          <>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg">{u.title || `Daily Update — ${u.update_date}`}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {u.progress_pct != null && <span className="px-2 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400">{u.progress_pct}%</span>}
                <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (DU_STATUS_BADGE[u.status || 'Pending'] || '')}>{u.status || 'Pending'}</span>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label="Date" value={u.update_date} />
              <Row label="By" value={u.author_name} />
              <Row label="Weather" value={u.weather} />
            </dl>
            {u.need_help && <div className="text-sm text-red-500 font-medium">⚠ This update is flagged as needing help.</div>}
            <div>
              <div className="text-xs text-slate-500 mb-1">Today's Work</div>
              <p className="text-sm whitespace-pre-wrap">{u.todays_work}</p>
            </div>
            {u.description && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Description</div>
                <p className="text-sm whitespace-pre-wrap">{u.description}</p>
              </div>
            )}
            {u.issues && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Issues</div>
                <p className="text-sm whitespace-pre-wrap text-red-500">{u.issues}</p>
              </div>
            )}
            {u.tomorrow_plan && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Tomorrow Plan</div>
                <p className="text-sm whitespace-pre-wrap">{u.tomorrow_plan}</p>
              </div>
            )}
            {u.remarks && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Remarks</div>
                <p className="text-sm whitespace-pre-wrap">{u.remarks}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1">Attachments</div>
                <div className="grid grid-cols-3 gap-2">
                  {attachments.map(a => {
                    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(a.file_name);
                    return isImage ? (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-black/10 dark:border-white/10 block">
                        <img src={a.url} alt={a.file_name} loading="lazy" className="w-full h-full object-cover" />
                      </a>
                    ) : (
                      <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-2 py-3 rounded-lg border border-black/10 dark:border-white/10 text-center">📎 {a.file_name}</a>
                    );
                  })}
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap gap-2">
                {DU_REVIEW_ACTIONS.filter(a => a.to !== u.status).map(a => (
                  <button key={a.to} disabled={busy} onClick={() => setReviewStatus(a.to)} className="text-xs px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 hover:border-brand-500/40">{a.label}</button>
                ))}
                {canDelete && <button disabled={busy} onClick={del} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-500 ml-auto">🗑 Delete</button>}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg border border-black/10 dark:border-white/10 text-sm">Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════ ACTIVITY ══════════════════════════════ */

function ActivityTab({ projectId }) {
  const { data, error } = useLiveData(`/api/projects/${projectId}/activity`, 15000);
  const rows = data?.activity || [];

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
      <h3 className="font-medium text-sm mb-3">Activity</h3>
      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
      {!data ? (
        <div className="text-sm text-slate-400 py-6 text-center">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">No activity recorded yet.</div>
      ) : (
        <ol className="relative border-s border-black/10 dark:border-white/10 ms-2 space-y-4">
          {rows.map(a => (
            <li key={a.id} className="ms-4">
              <div className="absolute w-2 h-2 rounded-full bg-brand-500 mt-1.5 -start-1" />
              <time className="block text-xs text-slate-400">{new Date(a.created_at).toLocaleString()}</time>
              <p className="text-sm">{a.activity}</p>
            </li>
          ))}
        </ol>
      )}
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
