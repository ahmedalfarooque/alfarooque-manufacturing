'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { ProjectModal } from '@/app/(protected)/projects/page';
import { GlassButton, GlassIconButton } from '@/components/glass';

/* Dynamic status-transition buttons (PR_ACTIONS / DU_REVIEW_ACTIONS) map to a
   GlassButton variant by semantic meaning of the target status, since the
   available transitions vary per click. */
function prActionVariant(to) {
  if (to === 'Rejected' || to === 'Cancelled') return 'danger';
  if (to === 'Approved' || to === 'Delivered' || to === 'Payment Completed') return 'success';
  if (to === 'On Hold') return 'warning';
  return 'secondary';
}
function duActionVariant(to) {
  if (to === 'Rejected') return 'danger';
  if (to === 'Approved' || to === 'Published') return 'success';
  if (to === 'Need Revision') return 'warning';
  return 'secondary';
}

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
/* Labels resolved through t('pd.duact.*') / t('pd.tab.*') at render
   time so they follow the live language toggle. */
const DU_REVIEW_ACTIONS = ['Approved', 'Rejected', 'Need Revision', 'Published'];

const TABS = [
  { key: 'overview', labelKey: 'pd.tab.overview' },
  { key: 'purchase-requests', labelKey: 'pd.tab.purchaseRequests' },
  { key: 'daily-updates', labelKey: 'pd.tab.dailyUpdates' },
  { key: 'documents', labelKey: 'pd.tab.documents' },
  { key: 'assigned-people', labelKey: 'pd.tab.assignedPeople' },
  { key: 'activity', labelKey: 'pd.tab.activity' },
];

export default function ProjectViewPage() {
  const { id } = useParams();
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  // Always starts at 'overview' so server and client render identically (no hydration mismatch), then synced from ?tab= right after mount.
  const [tab, setTab] = useState('overview');

  const { data, error, refresh } = useLiveData('/api/projects/' + id, 15000);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
    const t = new URLSearchParams(window.location.search).get('tab');
    if (TABS.some(x => x.key === t)) setTab(t);
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
  if (!data) return <Shell active="/projects"><div className="text-slate-400">{t('common.loading')}</div></Shell>;

  const { project: p, customer: c, documents, assignees } = data;
  const hasValue = p.value != null && Number(p.value) > 0;
  const isAssignedUser = (assignees || []).some(a => a.id === me?.id);
  const canCreate = isAdmin || isAssignedUser;

  return (
    <Shell active="/projects">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <a href="/projects" className="text-xs text-brand-500 hover:underline">{t('pd.backToProjects')}</a>
          <h2 className="text-lg font-semibold mt-1">{p.project_name}</h2>
          <p className="text-xs text-slate-500">{t('pd.breadcrumb', { name: p.project_name })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (STATUS_BADGE[p.status] || '')}>{trEnum(t, 'status', p.status)}</span>
          {isAdmin && <GlassButton onClick={() => setEditOpen(true)} variant="primary">{t('pd.edit')}</GlassButton>}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-black/5 dark:border-white/10 overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => selectTab(tb.key)}
            className={'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ' +
              (tab === tb.key ? 'border-brand-500 text-brand-500' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300')}>
            {t(tb.labelKey)}
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
  const { t } = useLanguage();
  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('pd.customerInformation')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('common.name')} value={c?.full_name || p.customer_name} />
            <Row label={t('pd.company')} value={c?.company_name || p.company_name} />
            <Row label={t('pd.contactPerson')} value={p.contact_person} />
            <Row label={t('common.email')} value={c?.email || p.contact_email} />
            <Row label={t('pd.phone')} value={c?.mobile_number || p.contact_phone} />
            <Row label={t('pd.vatNumber')} value={c?.vat_number} />
            <Row label={t('pd.crNumber')} value={c?.cr_number} />
            <Row label={t('pd.address')} value={p.address || c?.address} />
          </dl>
        </div>

        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
          <h3 className="font-medium text-sm mb-3">{t('pd.projectInformation')}</h3>
          <dl className="space-y-2 text-sm">
            <Row label={t('pd.projectName')} value={p.project_name} />
            <Row label={t('pd.shortSummary')} value={p.short_summary} />
            <Row label={t('common.status')} value={trEnum(t, 'status', p.status)} />
            <Row label={t('pd.progress')} value={p.progress + '%'} />
            <Row label={t('pd.startDate')} value={p.start_date} />
            <Row label={t('pd.endDate')} value={p.end_date} />
            {hasValue && <Row label={t('pd.projectValue')} value={'$' + Number(p.value).toLocaleString()} />}
          </dl>
        </div>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
        <h3 className="font-medium text-sm mb-3">{t('pd.completeProjectDetails')}</h3>
        <p className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">{p.project_details || t('pd.noAdditionalDetails')}</p>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
        <h3 className="font-medium text-sm mb-3">{t('pd.assignedUsers')}</h3>
        {assignees.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">{t('pd.noUsersAssigned')}</div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignees.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-black/5 dark:border-white/10 p-3">
                <Avatar name={u.full_name} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{u.full_name}{u.role === 'admin' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">{t('role.admin')}</span>}</div>
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
  const { t, formatDate } = useLanguage();
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{t('pd.tab.assignedPeople')}</h3>
        {isAdmin && <GlassButton onClick={onEdit} variant="primary">{t('pd.manageAssignees')}</GlassButton>}
      </div>
      {assignees.length === 0 ? (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-8 text-center text-sm text-slate-400">
          {t('pd.noUsersAssigned')}
        </div>
      ) : (
        <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[65vh]">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
              <tr>
                <th className="py-3 px-4">{t('common.name')}</th>
                <th>{t('pd.position')}</th>
                <th>{t('common.email')}</th>
                <th>{t('pd.phone')}</th>
                <th>{t('pd.department')}</th>
                <th>{t('pd.assignedDate')}</th>
                <th>{t('common.status')}</th>
              </tr>
            </thead>
            <tbody>
              {assignees.map(u => (
                <tr key={u.id} className="border-b border-black/5 dark:border-white/5">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <Avatar name={u.full_name} />
                      <span className="font-medium">{u.full_name}</span>
                      {u.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">{t('role.admin')}</span>}
                    </div>
                  </td>
                  <td>{u.position || '—'}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  <td>{u.department || '—'}</td>
                  <td>{u.assigned_at ? formatDate(u.assigned_at) : '—'}</td>
                  <td><span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{trEnum(t, 'status', u.status || 'Active')}</span></td>
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
  const { t } = useLanguage();
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
    if (!confirm(t('pd.deleteFileConfirm'))) return;
    const res = await fetch(`/api/projects/${projectId}/documents/${docId}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setLightbox(null); refresh(); }
  }

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{t('pd.imagesDocuments')}</h3>
        {isAdmin && (
          <label className="text-sm px-3 py-1.5 rounded-lg border border-black/10 dark:border-white/10 cursor-pointer">
            {uploadBusy ? t('pd.uploading') : t('pd.upload')}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" disabled={uploadBusy} onChange={uploadFile} />
          </label>
        )}
      </div>
      {uploadErr && <div className="text-red-500 text-sm mb-2">{uploadErr}</div>}
      {documents.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">{t('pd.noDocumentsYet')}</div>
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
                  <button type="button" onClick={() => deleteFile(d.id)} title={t('pd.deleteTitle')}
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
              {isAdmin && <GlassButton onClick={() => deleteFile(lightbox.id)} variant="danger">{t('pd.deleteBtn')}</GlassButton>}
              <GlassButton onClick={() => setLightbox(null)} variant="secondary">{t('pd.closeBtn')}</GlassButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ PURCHASE REQUESTS ══════════════════════════ */

function PurchaseRequestsTab({ projectId, canCreate, isAdmin }) {
  const { t } = useLanguage();
  const [modal, setModal] = useState(null); // 'new' | {id}
  const { data, error, refresh } = useLiveData(`/api/projects/${projectId}/purchase-requests`, 15000);
  const rows = data?.purchaseRequests || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{t('pd.tab.purchaseRequests')}</h3>
        {canCreate && <GlassButton onClick={() => setModal('new')} variant="primary">{t('pd.newPurchaseRequest')}</GlassButton>}
      </div>
      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[60vh]">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">{t('pd.date')}</th>
              <th>{t('pr.col.materials')}</th>
              <th>{t('pd.priority')}</th>
              <th>{t('pd.requestedBy')}</th>
              <th>{t('common.status')}</th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('pd.noPurchaseRequestsYet')}</td></tr>
            ) : rows.map(r => (
              <tr key={r.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{r.request_date}</td>
                <td className="max-w-[220px] truncate">{r.material_description}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_PRIORITY_BADGE[r.priority] || '')}>{trEnum(t, 'status', r.priority)}</span></td>
                <td>{r.requested_by_name || '—'}</td>
                <td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></td>
                <td className="text-right px-4"><GlassIconButton onClick={() => setModal({ id: r.id })} tone="neutral" title={t('pd.viewTitle')}>{'\u{1F441}'}</GlassIconButton></td>
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
  const { t } = useLanguage();
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
    if (f.size > 20 * 1024 * 1024) { setErr(t('pd.fileTooLarge20')); e.target.value = ''; return; }
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
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(t('pd.attachmentUploadFailed')));
          xhr.onerror = () => reject(new Error(t('pd.attachmentUploadFailed')));
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
        <h3 className="font-semibold text-lg">{t('pd.newPurchaseRequest').replace(/^\+\s*/, '')}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('pd.date')} type="date" value={form.request_date} onChange={set('request_date')} />
          <Field label={t('pd.supplierOptional')} value={form.supplier} onChange={set('supplier')} />
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.materialDescription')}</label>
            <textarea value={form.material_description} onChange={set('material_description')} rows={2} required
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.materialListOptional')}</label>
            <textarea value={form.material_list} onChange={set('material_list')} rows={3}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <Field label={t('pd.quantity')} type="number" value={form.quantity} onChange={set('quantity')} />
          <Field label={t('pd.unit')} value={form.unit} onChange={set('unit')} placeholder={t('pd.unitPlaceholder')} />
          <Field label={t('pd.estimatedPriceOptional')} type="number" value={form.estimated_price} onChange={set('estimated_price')} />
          <Field label={t('pd.requiredDate')} type="date" value={form.required_date} onChange={set('required_date')} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('pd.priority')}</label>
            <Dropdown value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
              options={['Normal', 'Urgent', 'Critical'].map(v => [v, trEnum(t, 'status', v)])} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.remarksOptional')}</label>
            <textarea value={form.remarks} onChange={set('remarks')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.attachmentOptional20')}</label>
            <input type="file" accept="image/*,.pdf,.xls,.xlsx,.doc,.docx,.zip" onChange={onFileChange}
              className="w-full text-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            {busy && file && <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }} /></div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <GlassButton type="button" onClick={onClose} variant="secondary">{t('common.cancel')}</GlassButton>
          <GlassButton disabled={busy} variant="primary">{busy ? t('pd.submitting') : t('pd.submit')}</GlassButton>
        </div>
      </form>
    </div>
  );
}

/* Target statuses; button labels come from t('pd.act.<status>') at render time. */
const PR_ACTIONS = ['Under Review', 'Approved', 'Rejected', 'On Hold', 'Purchased', 'Delivered', 'Payment Pending', 'Payment Completed', 'Cancelled'];

function PurchaseRequestDetailModal({ id, isAdmin, onClose, onChanged }) {
  const { t } = useLanguage();
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
    if (!confirm(t('pd.prDeleteConfirm'))) return;
    setBusy(true);
    try {
      await fetch(`/api/purchase-requests/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      onChanged(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full max-w-xl rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {!r ? <div className="text-slate-400 text-sm">{t('common.loading')}</div> : (
          <>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg">{t('pd.purchaseRequest')}</h3>
              <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label={t('pd.date')} value={r.request_date} />
              <Row label={t('pd.requestedBy')} value={r.requested_by_name} />
              <Row label={t('pd.supplier')} value={r.supplier} />
              <Row label={t('pd.priority')} value={trEnum(t, 'status', r.priority)} />
              <Row label={t('pd.quantity')} value={r.quantity ? `${r.quantity} ${r.unit || ''}` : null} />
              <Row label={t('pd.estimatedPrice')} value={r.estimated_price ? `SAR ${Number(r.estimated_price).toLocaleString()}` : null} />
              <Row label={t('pd.requiredDate')} value={r.required_date} />
            </dl>
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('pd.materialDescription')}</div>
              <p className="text-sm whitespace-pre-wrap">{r.material_description}</p>
            </div>
            {r.material_list && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.materialList')}</div>
                <p className="text-sm whitespace-pre-wrap">{r.material_list}</p>
              </div>
            )}
            {r.remarks && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.remarks')}</div>
                <p className="text-sm whitespace-pre-wrap">{r.remarks}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.attachments')}</div>
                <div className="flex flex-wrap gap-2">
                  {attachments.map(a => (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg border border-black/10 dark:border-white/10">📎 {a.file_name}</a>
                  ))}
                </div>
              </div>
            )}
            {isAdmin && (
              <div className="pt-2 border-t border-black/5 dark:border-white/10 flex flex-wrap gap-2">
                {PR_ACTIONS.filter(to => to !== r.status).map(to => (
                  <GlassButton key={to} disabled={busy} onClick={() => setStatus(to)} variant={prActionVariant(to)} className="text-xs px-3 py-1.5">{t('pd.act.' + to)}</GlassButton>
                ))}
                <GlassButton disabled={busy} onClick={del} variant="danger" className="text-xs px-3 py-1.5 ml-auto">{t('pd.deleteBtn')}</GlassButton>
              </div>
            )}
            <div className="flex justify-between items-center pt-2">
              <a href={'/purchase-requests/' + id} className="text-sm text-brand-500 hover:underline">{t('pd.viewFullDetails')}</a>
              <GlassButton onClick={onClose} variant="secondary">{t('pd.close')}</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════ DAILY UPDATES ══════════════════════════════ */

function DailyUpdatesTab({ projectId, canCreate, isAdmin, meId }) {
  const { t } = useLanguage();
  const [modal, setModal] = useState(null);
  const { data, error, refresh } = useLiveData(`/api/projects/${projectId}/daily-updates`, 15000);
  const rows = data?.dailyUpdates || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{t('pd.tab.dailyUpdates')}</h3>
        {canCreate && <GlassButton onClick={() => setModal('new')} variant="primary">{t('pd.newDailyUpdate')}</GlassButton>}
      </div>
      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[60vh]">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th className="py-3 px-4">{t('pd.date')}</th>
              <th>{t('pd.duUser')}</th>
              <th>{t('pd.duSummary')}</th>
              <th>{t('pd.progress')}</th>
              <th>{t('common.status')}</th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400">{t('pd.noDailyUpdatesYet')}</td></tr>
            ) : rows.map(u => (
              <tr key={u.id} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 px-4">{u.update_date}</td>
                <td>{u.author_name || '—'}</td>
                <td className="max-w-[260px] truncate">{u.title || u.todays_work}</td>
                <td>{u.progress_pct != null ? `${u.progress_pct}%` : '—'}</td>
                <td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (DU_STATUS_BADGE[u.status || 'Pending'] || '')}>{trEnum(t, 'status', u.status || 'Pending')}</span></td>
                <td className="text-right px-4"><GlassIconButton onClick={() => setModal({ id: u.id })} tone="neutral" title={t('pd.viewTitle')}>{'\u{1F441}'}</GlassIconButton></td>
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
  const { t } = useLanguage();
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
    if (f.size > 50 * 1024 * 1024) { setErr(t('pd.fileTooLarge50')); e.target.value = ''; return; }
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
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(t('pd.attachmentUploadFailed')));
          xhr.onerror = () => reject(new Error(t('pd.attachmentUploadFailed')));
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
        <h3 className="font-semibold text-lg">{t('pd.duModalTitle')}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('pd.date')} type="date" value={form.update_date} onChange={set('update_date')} />
          <Field label={t('pd.duTitleOptional')} value={form.title} onChange={set('title')} />
          <Field label={t('pd.duWeatherOptional')} value={form.weather} onChange={set('weather')} />
          <Field label={t('pd.duProgressPct')} type="number" min={0} max={100} value={form.progress_pct} onChange={set('progress_pct')} />
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.need_help} onChange={e => setForm(f => ({ ...f, need_help: e.target.checked }))} />
              {t('pd.duNeedHelp')}
            </label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.duTodaysWork')}</label>
            <textarea value={form.todays_work} onChange={set('todays_work')} rows={2} required
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.duDetailedDescription')}</label>
            <textarea value={form.description} onChange={set('description')} rows={3}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.duIssuesOptional')}</label>
            <textarea value={form.issues} onChange={set('issues')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.duTomorrowPlanOptional')}</label>
            <textarea value={form.tomorrow_plan} onChange={set('tomorrow_plan')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.remarksOptional')}</label>
            <textarea value={form.remarks} onChange={set('remarks')} rows={2}
              className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-slate-500 mb-1">{t('pd.attachmentsOptional50')}</label>
            <input type="file" accept="image/*,.pdf,video/*" onChange={onFileChange}
              className="w-full text-sm rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2" />
            {busy && file && <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }} /></div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <GlassButton type="button" onClick={onClose} variant="secondary">{t('common.cancel')}</GlassButton>
          <GlassButton disabled={busy} variant="primary">{busy ? t('common.saving') : t('common.save')}</GlassButton>
        </div>
      </form>
    </div>
  );
}

function DailyUpdateDetailModal({ id, isAdmin, meId, onClose, onChanged }) {
  const { t } = useLanguage();
  const { data, refresh } = useLiveData(`/api/daily-updates/${id}`, 0);
  const [busy, setBusy] = useState(false);
  const u = data?.dailyUpdate;
  const attachments = data?.attachments || [];
  const canDelete = isAdmin;

  async function del() {
    if (!confirm(t('pd.duDeleteConfirm'))) return;
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
        {!u ? <div className="text-slate-400 text-sm">{t('common.loading')}</div> : (
          <>
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-lg">{u.title || t('pd.duTitleFallback', { date: u.update_date })}</h3>
              <div className="flex items-center gap-2 shrink-0">
                {u.progress_pct != null && <span className="px-2 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400">{u.progress_pct}%</span>}
                <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (DU_STATUS_BADGE[u.status || 'Pending'] || '')}>{trEnum(t, 'status', u.status || 'Pending')}</span>
              </div>
            </div>
            <dl className="space-y-2 text-sm">
              <Row label={t('pd.date')} value={u.update_date} />
              <Row label={t('pd.duBy')} value={u.author_name} />
              <Row label={t('pd.duWeather')} value={u.weather} />
            </dl>
            {u.need_help && <div className="text-sm text-red-500 font-medium">{t('pd.duNeedHelpFlag')}</div>}
            <div>
              <div className="text-xs text-slate-500 mb-1">{t('pd.duTodaysWork')}</div>
              <p className="text-sm whitespace-pre-wrap">{u.todays_work}</p>
            </div>
            {u.description && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.duDescription')}</div>
                <p className="text-sm whitespace-pre-wrap">{u.description}</p>
              </div>
            )}
            {u.issues && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.duIssues')}</div>
                <p className="text-sm whitespace-pre-wrap text-red-500">{u.issues}</p>
              </div>
            )}
            {u.tomorrow_plan && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.duTomorrowPlan')}</div>
                <p className="text-sm whitespace-pre-wrap">{u.tomorrow_plan}</p>
              </div>
            )}
            {u.remarks && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.remarks')}</div>
                <p className="text-sm whitespace-pre-wrap">{u.remarks}</p>
              </div>
            )}
            {attachments.length > 0 && (
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('pd.attachments')}</div>
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
                {DU_REVIEW_ACTIONS.filter(to => to !== u.status).map(to => (
                  <GlassButton key={to} disabled={busy} onClick={() => setReviewStatus(to)} variant={duActionVariant(to)} className="text-xs px-3 py-1.5">{t('pd.duact.' + to)}</GlassButton>
                ))}
                {canDelete && <GlassButton disabled={busy} onClick={del} variant="danger" className="text-xs px-3 py-1.5 ml-auto">{t('pd.deleteBtn')}</GlassButton>}
              </div>
            )}
            <div className="flex justify-end pt-2">
              <GlassButton onClick={onClose} variant="secondary">{t('pd.close')}</GlassButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════ ACTIVITY ══════════════════════════════ */

function ActivityTab({ projectId }) {
  const { t, formatDate } = useLanguage();
  const { data, error } = useLiveData(`/api/projects/${projectId}/activity`, 15000);
  const rows = data?.activity || [];

  return (
    <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4">
      <h3 className="font-medium text-sm mb-3">{t('pd.activity')}</h3>
      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}
      {!data ? (
        <div className="text-sm text-slate-400 py-6 text-center">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <div className="text-sm text-slate-400 py-6 text-center">{t('pd.noActivityYet')}</div>
      ) : (
        <ol className="relative border-s border-black/10 dark:border-white/10 ms-2 space-y-4">
          {rows.map(a => (
            <li key={a.id} className="ms-4">
              <div className="absolute w-2 h-2 rounded-full bg-brand-500 mt-1.5 -start-1" />
              <time className="block text-xs text-slate-400">{formatDate(a.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</time>
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
