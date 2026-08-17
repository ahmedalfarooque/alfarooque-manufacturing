'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useLanguage, trEnum } from '@/lib/i18n';
import { ProjectModal } from '@/app/(protected)/projects/page';
import { Button, Input, Textarea, Field, Modal, EmptyState, Th, Td } from '@/components/ui';

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
  { key: 'financials', labelKey: 'pd.tab.financials' },
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

  if (error) return <Shell active="/projects"><div className="text-sm text-[#ef4444]">{error}</div></Shell>;
  if (!data) return <Shell active="/projects"><div className="text-[color:var(--tx-3)]">{t('common.loading')}</div></Shell>;

  const { project: p, customer: c, documents, assignees } = data;
  const hasValue = p.value != null && Number(p.value) > 0;
  const isAssignedUser = (assignees || []).some(a => a.id === me?.id);
  const canCreate = isAdmin || isAssignedUser;

  return (
    <Shell active="/projects">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <a href="/projects" className="text-xs text-brand-600 dark:text-brand-400 hover:underline">{t('pd.backToProjects')}</a>
          <h2 className="text-lg font-semibold mt-1">{p.project_name}</h2>
          <p className="text-xs text-[color:var(--tx-3)]">{t('pd.breadcrumb', { name: p.project_name })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={'px-3 py-1.5 rounded-full text-xs font-medium ' + (STATUS_BADGE[p.status] || '')}>{trEnum(t, 'status', p.status)}</span>
          {isAdmin && <Button onClick={() => setEditOpen(true)}>{t('pd.edit')}</Button>}
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-[color:var(--bd)] overflow-x-auto">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => selectTab(tb.key)}
            className={'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition ' +
              (tab === tb.key ? 'border-brand-600 text-brand-600 dark:text-brand-400' : 'border-transparent text-[color:var(--tx-3)] hover:text-[#5b5a52] dark:hover:text-white/80')}>
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab p={p} c={c} hasValue={hasValue} assignees={assignees || []} />}
      {tab === 'purchase-requests' && <PurchaseRequestsTab projectId={id} canCreate={canCreate} isAdmin={isAdmin} />}
      {tab === 'financials' && <FinancialsTab projectId={id} canCreate={canCreate} isAdmin={isAdmin} projectValue={p.value} projectName={p.project_name} />}
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
      <dt className="text-[color:var(--tx-3)]">{label}</dt>
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
        <div className="glass-card p-4">
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

        <div className="glass-card p-4">
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

      <div className="glass-card p-4 mb-4">
        <h3 className="font-medium text-sm mb-3">{t('pd.completeProjectDetails')}</h3>
        <p className="text-sm whitespace-pre-wrap text-[color:var(--tx)]">{p.project_details || t('pd.noAdditionalDetails')}</p>
      </div>

      <div className="glass-card p-4">
        <h3 className="font-medium text-sm mb-3">{t('pd.assignedUsers')}</h3>
        {assignees.length === 0 ? (
          <EmptyState text={t('pd.noUsersAssigned')} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {assignees.map(u => (
              <div key={u.id} className="flex items-center gap-3 rounded-lg border border-[color:var(--bd)] p-3">
                <Avatar name={u.full_name} />
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate">{u.full_name}{u.role === 'admin' && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">{t('role.admin')}</span>}</div>
                  <div className="text-xs text-[color:var(--tx-3)] truncate">{u.position || '—'}</div>
                  <div className="text-xs text-[color:var(--tx-3)] truncate">{u.email}</div>
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
        {isAdmin && <Button onClick={onEdit}>{t('pd.manageAssignees')}</Button>}
      </div>
      {assignees.length === 0 ? (
        <div className="glass-card p-8">
          <EmptyState text={t('pd.noUsersAssigned')} />
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-auto max-h-[65vh]">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
                <tr>
                  <Th>{t('common.name')}</Th>
                  <Th>{t('pd.position')}</Th>
                  <Th>{t('common.email')}</Th>
                  <Th>{t('pd.phone')}</Th>
                  <Th>{t('pd.department')}</Th>
                  <Th>{t('pd.assignedDate')}</Th>
                  <Th>{t('common.status')}</Th>
                </tr>
              </thead>
              <tbody>
                {assignees.map(u => (
                  <tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Avatar name={u.full_name} />
                        <span className="font-medium">{u.full_name}</span>
                        {u.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-500/10 text-brand-600 dark:text-brand-400">{t('role.admin')}</span>}
                      </div>
                    </Td>
                    <Td>{u.position || '—'}</Td>
                    <Td>{u.email}</Td>
                    <Td>{u.phone || '—'}</Td>
                    <Td>{u.department || '—'}</Td>
                    <Td>{u.assigned_at ? formatDate(u.assigned_at) : '—'}</Td>
                    <Td><span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{trEnum(t, 'status', u.status || 'Active')}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{t('pd.imagesDocuments')}</h3>
        {isAdmin && (
          <label className="text-sm px-3.5 py-2 rounded-lg border border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)] transition-colors duration-200 cursor-pointer">
            {uploadBusy ? t('pd.uploading') : t('pd.upload')}
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" disabled={uploadBusy} onChange={uploadFile} />
          </label>
        )}
      </div>
      {uploadErr && <div className="text-sm text-[#ef4444] mb-2">{uploadErr}</div>}
      {documents.length === 0 ? (
        <EmptyState text={t('pd.noDocumentsYet')} />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {documents.map(d => {
            const isImage = /\.(jpe?g|png|gif|webp)$/i.test(d.file_name);
            return (
              <div key={d.id} className="relative group">
                <button type="button" onClick={() => isImage && setLightbox(d)}
                  className="aspect-square w-full rounded-lg border border-[color:var(--bd)] overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  {isImage ? (
                    <img src={d.url} alt={d.file_name} loading="lazy" className="w-full h-full object-cover" />
                  ) : (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-center p-2 text-[color:var(--tx-3)]">📄<br />{d.file_name}</a>
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
              {isAdmin && <button onClick={() => deleteFile(lightbox.id)} className="gbtn gbtn-danger gbtn--sm">{t('pd.deleteBtn')}</button>}
              <button onClick={() => setLightbox(null)} className="px-3 py-1.5 rounded-lg bg-black/70 text-white text-sm">{t('pd.closeBtn')}</button>
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
  const [modal, setModal] = useState(null); // 'new' | 'connect' | {id}
  const { data, error, refresh } = useLiveData(`/api/projects/${projectId}/purchase-requests`, 15000);
  const rows = data?.purchaseRequests || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm">{t('pd.tab.purchaseRequests')}</h3>
        <div className="flex gap-2">
          {isAdmin && <Button variant="secondary" onClick={() => setModal('connect')}>Connect Existing</Button>}
          {canCreate && <Button onClick={() => setModal('new')}>{t('pd.newPurchaseRequest')}</Button>}
        </div>
      </div>
      {error && <div className="text-sm text-[#ef4444] mb-3">{error}</div>}
      <div className="glass-card overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
              <tr>
                <Th>{t('pd.date')}</Th>
                <Th>{t('pr.col.materials')}</Th>
                <Th>{t('pd.priority')}</Th>
                <Th>{t('pd.requestedBy')}</Th>
                <Th>{t('common.status')}</Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={6} className="py-8 text-center text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><EmptyState text={t('pd.noPurchaseRequestsYet')} /></td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <Td>{r.request_date}</Td>
                  <Td className="max-w-[220px] truncate">{r.material_description}</Td>
                  <Td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_PRIORITY_BADGE[r.priority] || '')}>{trEnum(t, 'status', r.priority)}</span></Td>
                  <Td>{r.requested_by_name || '—'}</Td>
                  <Td><span className={'px-2 py-1 rounded-full text-xs font-medium ' + (PR_STATUS_BADGE[r.status] || '')}>{trEnum(t, 'status', r.status)}</span></Td>
                  <Td className="text-end"><button onClick={() => setModal({ id: r.id })} className="text-[color:var(--tx-3)]" title={t('pd.viewTitle')}>{'\u{1F441}'}</button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal === 'new' && <PurchaseRequestModal projectId={projectId} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal === 'connect' && <ConnectExistingPurchaseRequestModal projectId={projectId} onClose={() => setModal(null)} onConnected={() => { setModal(null); refresh(); }} />}
      {modal && modal !== 'new' && modal !== 'connect' && <PurchaseRequestDetailModal id={modal.id} isAdmin={isAdmin} onClose={() => setModal(null)} onChanged={refresh} />}
    </div>
  );
}

function ConnectExistingPurchaseRequestModal({ projectId, onClose, onConnected }) {
  const { data } = useLiveData('/api/purchase-requests?unassigned=1', 0);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(null);
  const rows = (data?.purchaseRequests || []).filter(r => !search.trim()
    || `${r.material_description || ''} ${r.supplier || ''}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function connect(id) {
    setBusy(id);
    try {
      const res = await fetch(`/api/purchase-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ project_id: projectId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Could not connect.');
      onConnected();
    } catch (e) { alert(e.message); } finally { setBusy(null); }
  }

  return (
    <Modal title="Connect Existing Purchase Request" onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-sm">
          Only standalone Purchase Requests (created without a project, e.g. from Accounting) are shown here.
        </div>
        <Input placeholder="Search material, supplier…" value={search} onChange={e => setSearch(e.target.value)} />
        {!data ? <div className="py-6 text-center text-sm text-[color:var(--tx-3)]">Loading…</div>
          : !rows.length ? <div className="py-6 text-center text-sm text-[color:var(--tx-3)]">No standalone purchase requests found.</div>
          : <div className="max-h-80 space-y-2 overflow-auto">{rows.map(r => (
              <button key={r.id} disabled={busy === r.id} onClick={() => connect(r.id)}
                className="block w-full rounded-xl border border-[color:var(--bd)] p-3 text-start text-sm hover:bg-[color:var(--pr-soft)] disabled:opacity-50">
                <div className="font-medium">{r.material_description}</div>
                <div className="text-xs text-[color:var(--tx-3)]">{r.request_date} · {r.supplier || 'No supplier'} · {r.estimated_price != null ? `${Number(r.estimated_price).toFixed(2)} SAR` : 'Amount not specified'}</div>
              </button>
            ))}</div>}
      </div>
    </Modal>
  );
}

function PurchaseRequestModal({ projectId, onClose, onSaved }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({
    request_date: new Date().toISOString().slice(0, 10), supplier: '', material_description: '', material_list: '',
    quantity: '', unit: '', estimated_price: '', required_date: '', priority: 'Normal', remarks: '',
    inv_material_id: '', inv_product_id: '',
  });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  // Additive inventory lookup — lets a requester link this purchase request
  // to an existing Inventory item so it shows real on-hand stock instead of
  // free text alone. Does not change the existing required fields/workflow.
  const [invQuery, setInvQuery] = useState('');
  const [invResults, setInvResults] = useState(null);
  const [invPicked, setInvPicked] = useState(null);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemForm, setAddItemForm] = useState({ kind: 'product', name: '' });
  const [addItemBusy, setAddItemBusy] = useState(false);

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

  /* inv_material_id/inv_product_id carry a real FK to inv_materials/
     inv_products — a qt_materials- or legacy-products-sourced fallback row
     has no matching row there, so linking one would violate the FK and
     silently 500 on save. Those rows are reference-only; Add New Item
     creates a real linkable row first. */
  function isLinkable(item) { return !item.source_table || item.source_table === 'inv_products' || item.source_table === 'inv_materials'; }

  function pickInventoryItem(item, kind) {
    setInvPicked({ ...item, kind });
    setInvResults(null);
    setInvQuery('');
    setForm(f => ({
      ...f,
      inv_material_id: kind === 'material' ? item.id : '',
      inv_product_id: kind === 'product' ? item.id : '',
      material_description: f.material_description || item.name,
      unit: f.unit || item.unit || '',
    }));
  }

  function clearInventoryItem() {
    setInvPicked(null);
    setForm(f => ({ ...f, inv_material_id: '', inv_product_id: '' }));
  }

  async function submitAddItem() {
    const name = addItemForm.name.trim();
    if (!name) return;
    setAddItemBusy(true);
    try {
      const r = await fetch('/api/inventory-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(addItemForm) });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error || 'Could not add item.');
      const created = p.product || p.material;
      pickInventoryItem(created, addItemForm.kind);
      setAddItemOpen(false); setAddItemForm({ kind: 'product', name: '' });
    } catch (e2) { setErr(e2.message); }
    setAddItemBusy(false);
  }

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
    <>
    <Modal title={t('pd.newPurchaseRequest').replace(/^\+\s*/, '')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-sm text-[#ef4444]">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('pd.date')}><Input type="date" value={form.request_date} onChange={set('request_date')} /></Field>
          <Field label={t('pd.supplierOptional')}><Input value={form.supplier} onChange={set('supplier')} /></Field>
          <div className="col-span-2">
            <Field label={t('pd.materialDescription')}>
              <Textarea value={form.material_description} onChange={set('material_description')} rows={2} required />
            </Field>
          </div>
          <div className="col-span-2 relative">
            <Field label={t('pd.linkInventoryItem')}>
              {invPicked ? (
                <div className="flex items-center justify-between rounded-lg border border-black/10 dark:border-white/10 px-3 py-2 text-sm">
                  <span>{invPicked.name} <span className="text-xs opacity-60">({invPicked.kind === 'product' ? invPicked.sku : invPicked.material_code || '—'})</span></span>
                  <button type="button" onClick={clearInventoryItem} className="text-xs text-[#ef4444] hover:underline">{t('common.clear')}</button>
                </div>
              ) : (
                <Input value={invQuery} onChange={e => setInvQuery(e.target.value)} placeholder={t('pd.linkInventoryItemPlaceholder')} />
              )}
            </Field>
            {invResults && (invResults.products?.length > 0 || invResults.materials?.length > 0) && (
              <div className="absolute z-30 mt-1 w-full rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-neutral-900 shadow-lg max-h-64 overflow-y-auto">
                {invResults.products?.map(p => (
                  <button key={'p:' + p.id} type="button" disabled={!isLinkable(p)} onClick={() => isLinkable(p) && pickInventoryItem(p, 'product')}
                    className={'block w-full text-start px-3 py-2 text-sm ' + (isLinkable(p) ? 'hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-not-allowed opacity-50')}>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs opacity-60">{p.sku || '—'} · {t('pd.stockOnHand')}: {Number(p.qty_on_hand || 0).toLocaleString()}{!isLinkable(p) && ' · not linkable — use Add New Item'}</div>
                  </button>
                ))}
                {invResults.materials?.map(m => (
                  <button key={'m:' + m.id} type="button" disabled={!isLinkable(m)} onClick={() => isLinkable(m) && pickInventoryItem(m, 'material')}
                    className={'block w-full text-start px-3 py-2 text-sm ' + (isLinkable(m) ? 'hover:bg-black/5 dark:hover:bg-white/5' : 'cursor-not-allowed opacity-50')}>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs opacity-60">{m.material_code || '—'} · {t('pd.stockOnHand')}: {Number(m.qty_on_hand || 0).toLocaleString()}{!isLinkable(m) && ' · not linkable — use Add New Item'}</div>
                  </button>
                ))}
              </div>
            )}
            {invResults && ![...(invResults.products || []), ...(invResults.materials || [])].some(isLinkable) && (
              <div className="mt-1 rounded-lg border border-black/10 dark:border-white/10 p-3 text-sm">
                {t('pd.noMatchFound') === 'pd.noMatchFound' ? 'No matching item found.' : t('pd.noMatchFound')}
                <button type="button" onClick={() => { setAddItemForm({ kind: 'product', name: invQuery.trim() }); setAddItemOpen(true); }}
                  className="mt-1 block font-medium text-[#0ea5a4] hover:underline">{t('pd.addNewItem') === 'pd.addNewItem' ? '+ Add New Material / Item' : t('pd.addNewItem')}</button>
              </div>
            )}
            {!invPicked && !invResults && (
              <button type="button" onClick={() => { setAddItemForm({ kind: 'product', name: '' }); setAddItemOpen(true); }}
                className="mt-1 text-xs text-[#0ea5a4] hover:underline">{t('pd.addNewItem') === 'pd.addNewItem' ? '+ Add New Material / Item' : t('pd.addNewItem')}</button>
            )}
          </div>
          <div className="col-span-2">
            <Field label={t('pd.materialListOptional')}>
              <Textarea value={form.material_list} onChange={set('material_list')} rows={3} />
            </Field>
          </div>
          <Field label={t('pd.quantity')}><Input type="number" value={form.quantity} onChange={set('quantity')} /></Field>
          <Field label={t('pd.unit')}><Input value={form.unit} onChange={set('unit')} placeholder={t('pd.unitPlaceholder')} /></Field>
          <Field label={t('pd.estimatedPriceOptional')}><Input type="number" value={form.estimated_price} onChange={set('estimated_price')} /></Field>
          <Field label={t('pd.requiredDate')}><Input type="date" value={form.required_date} onChange={set('required_date')} /></Field>
          <Field label={t('pd.priority')}>
            <Dropdown value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
              options={['Normal', 'Urgent', 'Critical'].map(v => [v, trEnum(t, 'status', v)])} />
          </Field>
          <div className="col-span-2">
            <Field label={t('pd.remarksOptional')}>
              <Textarea value={form.remarks} onChange={set('remarks')} rows={2} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.attachmentOptional20')}>
              <input type="file" accept="image/*,.pdf,.xls,.xlsx,.doc,.docx,.zip" onChange={onFileChange}
                className="ginput text-sm" />
            </Field>
            {busy && file && <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }} /></div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('pd.submitting') : t('pd.submit')}</Button>
        </div>
      </form>
    </Modal>
    {addItemOpen && (
      <Modal title={t('pd.addNewItemTitle') === 'pd.addNewItemTitle' ? 'Add New Material / Item' : t('pd.addNewItemTitle')} onClose={() => setAddItemOpen(false)}>
        <div className="space-y-3">
          <Field label={t('pd.itemType') === 'pd.itemType' ? 'Type' : t('pd.itemType')}>
            <Dropdown value={addItemForm.kind} onChange={v => setAddItemForm(f => ({ ...f, kind: v }))}
              options={[['product', t('pd.itemTypeProduct') === 'pd.itemTypeProduct' ? 'Product' : t('pd.itemTypeProduct')], ['material', t('pd.itemTypeMaterial') === 'pd.itemTypeMaterial' ? 'Material' : t('pd.itemTypeMaterial')]]} />
          </Field>
          <Field label={t('pd.itemName') === 'pd.itemName' ? 'Name *' : t('pd.itemName')}>
            <Input value={addItemForm.name} onChange={e => setAddItemForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label={t('pd.itemCode') === 'pd.itemCode' ? 'Code (optional)' : t('pd.itemCode')}>
            <Input value={(addItemForm.kind === 'material' ? addItemForm.material_code : addItemForm.sku) || ''}
              onChange={e => setAddItemForm(f => ({ ...f, [addItemForm.kind === 'material' ? 'material_code' : 'sku']: e.target.value }))} />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setAddItemOpen(false)}>{t('common.cancel')}</Button>
            <Button type="button" onClick={submitAddItem} disabled={addItemBusy}>{addItemBusy ? t('pd.submitting') : (t('pd.addAndSelect') === 'pd.addAndSelect' ? 'Add & Select' : t('pd.addAndSelect'))}</Button>
          </div>
        </div>
      </Modal>
    )}
    </>
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
    <Modal title={t('pd.purchaseRequest')} onClose={onClose}>
      {!r ? <div className="text-[color:var(--tx-3)] text-sm">{t('common.loading')}</div> : (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
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
            <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.materialDescription')}</div>
            <p className="text-sm whitespace-pre-wrap">{r.material_description}</p>
          </div>
          {r.material_list && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.materialList')}</div>
              <p className="text-sm whitespace-pre-wrap">{r.material_list}</p>
            </div>
          )}
          {r.remarks && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.remarks')}</div>
              <p className="text-sm whitespace-pre-wrap">{r.remarks}</p>
            </div>
          )}
          {attachments.length > 0 && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.attachments')}</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map(a => (
                  <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-2 py-1 rounded-lg border border-[color:var(--bd)]">📎 {a.file_name}</a>
                ))}
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="pt-2 border-t border-[color:var(--bd)] flex flex-wrap gap-2">
              {PR_ACTIONS.filter(to => to !== r.status).map(to => (
                <Button key={to} variant="ghost" disabled={busy} onClick={() => setStatus(to)}>{t('pd.act.' + to)}</Button>
              ))}
              <Button variant="danger" disabled={busy} onClick={del} className="ml-auto">{t('pd.deleteBtn')}</Button>
            </div>
          )}
          <div className="flex justify-between items-center pt-2">
            <a href={'/purchase-requests/' + id} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">{t('pd.viewFullDetails')}</a>
            <Button variant="ghost" onClick={onClose}>{t('pd.close')}</Button>
          </div>
        </div>
      )}
    </Modal>
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
        {canCreate && <Button onClick={() => setModal('new')}>{t('pd.newDailyUpdate')}</Button>}
      </div>
      {error && <div className="text-sm text-[#ef4444] mb-3">{error}</div>}
      <div className="glass-card overflow-hidden">
        <div className="overflow-auto max-h-[60vh]">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
              <tr>
                <Th>{t('pd.date')}</Th>
                <Th>{t('pd.duUser')}</Th>
                <Th>{t('pd.duSummary')}</Th>
                <Th>{t('pd.progress')}</Th>
                <Th>{t('common.status')}</Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={6} className="py-8 text-center text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6}><EmptyState text={t('pd.noDailyUpdatesYet')} /></td></tr>
              ) : rows.map(u => (
                <tr key={u.id}>
                  <Td>{u.update_date}</Td>
                  <Td>{u.author_name || '—'}</Td>
                  <Td className="max-w-[260px] truncate">{u.title || u.todays_work}</Td>
                  <Td>{u.progress_pct != null ? `${u.progress_pct}%` : '—'}</Td>
                  <Td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (DU_STATUS_BADGE[u.status || 'Pending'] || '')}>{trEnum(t, 'status', u.status || 'Pending')}</span></Td>
                  <Td className="text-end"><button onClick={() => setModal({ id: u.id })} className="text-[color:var(--tx-3)]" title={t('pd.viewTitle')}>{'\u{1F441}'}</button></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
    <Modal title={t('pd.duModalTitle')} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-sm text-[#ef4444]">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('pd.date')}><Input type="date" value={form.update_date} onChange={set('update_date')} /></Field>
          <Field label={t('pd.duTitleOptional')}><Input value={form.title} onChange={set('title')} /></Field>
          <Field label={t('pd.duWeatherOptional')}><Input value={form.weather} onChange={set('weather')} /></Field>
          <Field label={t('pd.duProgressPct')}><Input type="number" min={0} max={100} value={form.progress_pct} onChange={set('progress_pct')} /></Field>
          <div className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.need_help} onChange={e => setForm(f => ({ ...f, need_help: e.target.checked }))} />
              {t('pd.duNeedHelp')}
            </label>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.duTodaysWork')}>
              <Textarea value={form.todays_work} onChange={set('todays_work')} rows={2} required />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.duDetailedDescription')}>
              <Textarea value={form.description} onChange={set('description')} rows={3} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.duIssuesOptional')}>
              <Textarea value={form.issues} onChange={set('issues')} rows={2} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.duTomorrowPlanOptional')}>
              <Textarea value={form.tomorrow_plan} onChange={set('tomorrow_plan')} rows={2} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.remarksOptional')}>
              <Textarea value={form.remarks} onChange={set('remarks')} rows={2} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label={t('pd.attachmentsOptional50')}>
              <input type="file" accept="image/*,.pdf,video/*" onChange={onFileChange}
                className="ginput text-sm" />
            </Field>
            {busy && file && <div className="mt-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden"><div className="h-full bg-brand-500 transition-all" style={{ width: progress + '%' }} /></div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
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
    <Modal title={u ? (u.title || t('pd.duTitleFallback', { date: u.update_date })) : t('pd.tab.dailyUpdates')} onClose={onClose}>
      {!u ? <div className="text-[color:var(--tx-3)] text-sm">{t('common.loading')}</div> : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {u.progress_pct != null && <span className="px-2 py-1 rounded-full text-xs font-medium bg-brand-500/10 text-brand-600 dark:text-brand-400">{u.progress_pct}%</span>}
            <span className={'px-2 py-1 rounded-full text-xs font-medium ' + (DU_STATUS_BADGE[u.status || 'Pending'] || '')}>{trEnum(t, 'status', u.status || 'Pending')}</span>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label={t('pd.date')} value={u.update_date} />
            <Row label={t('pd.duBy')} value={u.author_name} />
            <Row label={t('pd.duWeather')} value={u.weather} />
          </dl>
          {u.need_help && <div className="text-sm text-[#ef4444] font-medium">{t('pd.duNeedHelpFlag')}</div>}
          <div>
            <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.duTodaysWork')}</div>
            <p className="text-sm whitespace-pre-wrap">{u.todays_work}</p>
          </div>
          {u.description && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.duDescription')}</div>
              <p className="text-sm whitespace-pre-wrap">{u.description}</p>
            </div>
          )}
          {u.issues && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.duIssues')}</div>
              <p className="text-sm whitespace-pre-wrap text-[#ef4444]">{u.issues}</p>
            </div>
          )}
          {u.tomorrow_plan && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.duTomorrowPlan')}</div>
              <p className="text-sm whitespace-pre-wrap">{u.tomorrow_plan}</p>
            </div>
          )}
          {u.remarks && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.remarks')}</div>
              <p className="text-sm whitespace-pre-wrap">{u.remarks}</p>
            </div>
          )}
          {attachments.length > 0 && (
            <div>
              <div className="text-xs text-[color:var(--tx-3)] mb-1">{t('pd.attachments')}</div>
              <div className="grid grid-cols-3 gap-2">
                {attachments.map(a => {
                  const isImage = /\.(jpe?g|png|gif|webp)$/i.test(a.file_name);
                  return isImage ? (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden border border-[color:var(--bd)] block">
                      <img src={a.url} alt={a.file_name} loading="lazy" className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="text-xs px-2 py-3 rounded-lg border border-[color:var(--bd)] text-center">📎 {a.file_name}</a>
                  );
                })}
              </div>
            </div>
          )}
          {isAdmin && (
            <div className="pt-2 border-t border-[color:var(--bd)] flex flex-wrap gap-2">
              {DU_REVIEW_ACTIONS.filter(to => to !== u.status).map(to => (
                <Button key={to} variant="ghost" disabled={busy} onClick={() => setReviewStatus(to)}>{t('pd.duact.' + to)}</Button>
              ))}
              {canDelete && <Button variant="danger" disabled={busy} onClick={del} className="ml-auto">{t('pd.deleteBtn')}</Button>}
            </div>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={onClose}>{t('pd.close')}</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ══════════════════════════════ ACTIVITY ══════════════════════════════ */

function FinancialsTab({ projectId, canCreate, isAdmin, projectValue, projectName }) {
  const { t, lang } = useLanguage();
  const { data, error, refresh } = useLiveData(`/api/projects/${projectId}/financials`, 15000);
  const [open,setOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState('');
  const [form,setForm] = useState({source_record_id:'',amount:'',payment_date:new Date().toISOString().slice(0,10),payment_method:'bank_transfer',reference:'',notes:''});
  const [purchaseDetail,setPurchaseDetail] = useState(null);
  const [paymentDetail,setPaymentDetail] = useState(null);
  const invoices=data?.invoices||[]; const summary=data?.summary||{}; const pr=data?.purchaseRequests||{count:0,estimatedKnownTotal:0,knownCount:0,unknownCount:0};
  const purchases = invoices.filter(row=>row.record_type==='purchase_invoice');
  /* Received Payments = the SAME connected-sales-invoice reflected_paid the
     "Payments received" summary metric already uses (real SmartLife
     paid_amount, maxed against any ERP-local payment rows on top of it) —
     never a separate erp_project_payments-only view, which would miss any
     payment already recorded directly on the SmartLife invoice. One row
     per invoice with an actual paid amount; the sum of this list always
     equals summary.payments_received by construction. */
  const receivedPayments = invoices.filter(row=>row.record_type==='sales_invoice'&&row.reflected_paid>0);
  const totalReceived = summary.payments_received||0;
  const balanceToPay = Math.max(Number(projectValue||0)-totalReceived,0);
  const money=value=>`${Number(value||0).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} SAR`;

  async function submit(e){e.preventDefault();setBusy(true);setErr('');try{const r=await fetch(`/api/projects/${projectId}/financials`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({action:'add-payment',...form})});const p=await r.json();if(!r.ok)throw new Error(p.error);setOpen(false);setForm({source_record_id:'',amount:'',payment_date:new Date().toISOString().slice(0,10),payment_method:'bank_transfer',reference:'',notes:''});refresh();}catch(x){setErr(x.message)}finally{setBusy(false)}}

  async function disconnectPurchase(sourceRecordId) {
    if (!confirm(t('pd.fin.confirmDisconnectPurchase') === 'pd.fin.confirmDisconnectPurchase' ? 'Remove this purchase from the project? The Accounting/SmartLife record itself is not deleted.' : t('pd.fin.confirmDisconnectPurchase'))) return;
    try {
      const r = await fetch(`/api/projects/${projectId}/financials`, { method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ action:'disconnect-purchase', source_record_id: sourceRecordId }) });
      if (!r.ok) { const p = await r.json(); throw new Error(p.error); }
      setPurchaseDetail(null); refresh();
    } catch (e2) { alert(e2.message); }
  }

  async function disconnectInvoice(sourceRecordId) {
    if (!confirm(t('pd.fin.confirmDisconnectInvoice'))) return;
    try {
      const r = await fetch(`/api/projects/${projectId}/financials`, { method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ action:'disconnect-invoice', source_record_id: sourceRecordId }) });
      if (!r.ok) { const p = await r.json(); throw new Error(p.error); }
      setPaymentDetail(null); refresh();
    } catch (e2) { alert(e2.message); }
  }

  async function deletePayment(paymentId) {
    if (!confirm(t('pd.fin.confirmDeletePayment') === 'pd.fin.confirmDeletePayment' ? 'Delete this payment record?' : t('pd.fin.confirmDeletePayment'))) return;
    try {
      const r = await fetch(`/api/projects/${projectId}/financials`, { method:'DELETE', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body:JSON.stringify({ action:'delete-payment', payment_id: paymentId }) });
      if (!r.ok) { const p = await r.json(); throw new Error(p.error); }
      setPaymentDetail(null); refresh();
    } catch (e2) { alert(e2.message); }
  }

  async function printPurchase(row) {
    /* apps/projects/lib/reportPdf.js is the plain generic-report mirror
       (title/columns/rows/lang/fileName/action only) — unlike Accounting's
       own fork, it has no period/source/totals footer concept. Fold that
       context into the title and into extra rows using the same column
       shape instead of passing unsupported params that would be silently
       dropped. */
    const { exportReportPdf } = await import('@/lib/reportPdf');
    const items = row.raw_payload?.items || [];
    const blank = { product_name: '', product_code: '', quantity: '', unit_cost: '' };
    await exportReportPdf({
      title: `${projectName} — ${t('pd.fin.purchase')} #${row.source_reference || row.external_id} — ${row.record_date} — ${row.party_name || ''}`,
      columns: [
        { key: 'product_name', header: t('pd.fin.item') }, { key: 'product_code', header: t('pd.fin.code') },
        { key: 'quantity', header: t('pd.fin.qty') }, { key: 'unit_cost', header: t('pd.fin.unitCost') }, { key: 'total', header: t('pd.fin.total') },
      ],
      rows: [
        ...items.map(it => ({ product_name: it.product_name, product_code: it.product_code, quantity: it.quantity, unit_cost: it.unit_cost, total: it.total })),
        { ...blank, product_name: t('pd.fin.subtotal'), total: money(row.subtotal) },
        { ...blank, product_name: t('pd.fin.vat'), total: money(row.vat_amount) },
        { ...blank, product_name: t('pd.fin.total'), total: money(row.total_amount) },
        { ...blank, product_name: t('pd.fin.amountPaid'), total: money(row.reflected_paid) },
        { ...blank, product_name: t('pd.fin.remaining'), total: money(row.reflected_balance) },
      ],
      lang, fileName: `purchase-${row.source_reference || row.external_id}.pdf`, action: 'print',
    });
  }

  async function printPayment(row) {
    const { exportReportPdf } = await import('@/lib/reportPdf');
    await exportReportPdf({
      title: `${projectName} — ${t('pd.fin.receivedPayment')} — ${row.source_reference || row.external_id}`,
      columns: [{ key: 'label', header: lang === 'ar' ? 'الحقل' : 'Field' }, { key: 'value', header: lang === 'ar' ? 'القيمة' : 'Value' }],
      rows: [
        { label: t('pd.fin.invoiceNumber'), value: row.source_reference || row.external_id }, { label: t('pd.fin.customer'), value: row.party_name || '—' },
        { label: t('pd.fin.invoiceDate'), value: row.record_date }, { label: t('pd.fin.invoiceTotal'), value: money(row.total_amount) },
        { label: t('pd.fin.amountPaid'), value: money(row.reflected_paid) }, { label: t('pd.fin.remaining'), value: money(row.reflected_balance) },
        { label: t('pd.fin.status'), value: row.payment_status },
        { label: t('pd.fin.projectValue'), value: money(projectValue) }, { label: t('pd.fin.paidAmount'), value: money(totalReceived) },
        { label: t('pd.fin.balanceToPay'), value: money(balanceToPay) },
      ],
      lang, fileName: `payment-${row.source_reference || row.external_id}.pdf`, action: 'print',
    });
  }

  return <div className="space-y-4">
    {error&&<div className="text-sm text-red-500">{error}</div>}

    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-[color:var(--tx-3)]">{t('pd.fin.projectSummary') === 'pd.fin.projectSummary' ? 'Project Summary' : t('pd.fin.projectSummary')}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <FinancialMetric label={t('pd.fin.projectValue') === 'pd.fin.projectValue' ? 'Project Value' : t('pd.fin.projectValue')} value={money(projectValue)}/>
        <FinancialMetric label={t('pd.fin.paidAmount') === 'pd.fin.paidAmount' ? 'Paid Amount' : t('pd.fin.paidAmount')} value={money(totalReceived)}/>
        <FinancialMetric label={t('pd.fin.balanceToPay') === 'pd.fin.balanceToPay' ? 'Balance To Pay' : t('pd.fin.balanceToPay')} value={money(balanceToPay)}/>
      </div>
    </div>

    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-[color:var(--tx-3)]">{t('pd.fin.actualHeading')}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><FinancialMetric label={t('pd.fin.revenue')} value={money(summary.revenue)}/><FinancialMetric label={t('pd.fin.paymentsReceived')} value={money(summary.payments_received)}/><FinancialMetric label={t('pd.fin.outstandingReceivables')} value={money(summary.receivables)}/><FinancialMetric label={t('pd.fin.profit')} value={money(summary.profit)}/><FinancialMetric label={t('pd.fin.actualPurchaseCost')} value={money(summary.purchases)}/><FinancialMetric label={t('pd.fin.paymentsMade')} value={money(summary.payments_made)}/><FinancialMetric label={t('pd.fin.outstandingPayables')} value={money(summary.payables)}/></div>
    </div>
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase text-[color:var(--tx-3)]">{t('pd.fin.plannedHeading')}</h3>
      <div className="grid gap-3 sm:grid-cols-3"><FinancialMetric label={t('pd.fin.purchaseRequestsCount')} value={String(pr.count)}/><FinancialMetric label={t('pd.fin.estimatedKnown')} value={money(pr.estimatedKnownTotal)}/><FinancialMetric label={t('pd.fin.requestsNoAmount')} value={String(pr.unknownCount)}/></div>
    </div>

    <div className="glass-card p-4">
      <div className="mb-3"><h3 className="font-medium">{t('pd.fin.purchases')}</h3><p className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.purchasesNotice')}</p></div>
      {!purchases.length?<EmptyState text={t('pd.fin.noPurchases')}/>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><Th>{t('pd.fin.purchase')}</Th><Th>{t('pd.fin.date')}</Th><Th>{t('pd.fin.supplier')}</Th><Th>{t('pd.fin.total')}</Th><Th>{t('pd.fin.remaining')}</Th><Th>{t('pd.fin.status')}</Th></tr></thead><tbody>{purchases.map(row=><tr key={row.id} className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={()=>setPurchaseDetail(row)}><Td>{row.source_reference||row.external_id}</Td><Td>{row.record_date}</Td><Td>{row.party_name||'—'}</Td><Td>{money(row.total_amount)}</Td><Td>{money(row.reflected_balance)}</Td><Td>{row.payment_status}</Td></tr>)}</tbody></table></div>}
    </div>

    <div className="glass-card p-4">
      <div className="mb-3 flex items-center justify-between"><div><h3 className="font-medium">{t('pd.fin.receivedPayments')}</h3><p className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.receivedPaymentsNotice')}</p></div>{canCreate&&invoices.filter(r=>r.record_type==='sales_invoice').length>0&&<Button onClick={()=>setOpen(true)}>{t('pd.fin.addPayment')}</Button>}</div>
      {!receivedPayments.length?<EmptyState text={t('pd.fin.noPaymentsReceived')}/>:<div className="overflow-auto"><table className="w-full text-sm"><thead><tr><Th>{t('pd.fin.invoice')}</Th><Th>{t('pd.fin.date')}</Th><Th>{t('pd.fin.customer')}</Th><Th>{t('pd.fin.invoiceTotal')}</Th><Th>{t('pd.fin.amountPaid')}</Th><Th>{t('pd.fin.remaining')}</Th><Th>{t('pd.fin.status')}</Th></tr></thead><tbody>{receivedPayments.map(row=><tr key={row.id} className="cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" onClick={()=>setPaymentDetail(row)}><Td>{row.source_reference||row.external_id}</Td><Td>{row.record_date}</Td><Td>{row.party_name||'—'}</Td><Td>{money(row.total_amount)}</Td><Td>{money(row.reflected_paid)}</Td><Td>{money(row.reflected_balance)}</Td><Td>{row.payment_status}</Td></tr>)}</tbody></table></div>}
    </div>

    {open&&<Modal title={t('pd.fin.addProjectPayment')} onClose={()=>setOpen(false)}><form onSubmit={submit} className="space-y-4">{err&&<div className="text-sm text-red-500">{err}</div>}<Field label={t('pd.fin.relatedInvoice')}><select className="ginput" value={form.source_record_id} onChange={e=>setForm(f=>({...f,source_record_id:e.target.value}))} required><option value="">{t('pd.fin.selectInvoice')}</option>{invoices.filter(r=>r.record_type==='sales_invoice').map(row=><option key={row.id} value={row.id}>{row.source_reference||row.external_id} · {money(row.total_amount)} · {t('pd.fin.remaining')} {money(row.reflected_balance)}</option>)}</select></Field><div className="grid grid-cols-2 gap-3"><Field label={t('pd.fin.amount')}><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} required/></Field><Field label={t('pd.fin.paymentDate')}><Input type="date" value={form.payment_date} onChange={e=>setForm(f=>({...f,payment_date:e.target.value}))} required/></Field><Field label={t('pd.fin.paymentMethod')}><select className="ginput" value={form.payment_method} onChange={e=>setForm(f=>({...f,payment_method:e.target.value}))}><option value="bank_transfer">{t('pd.fin.bankTransfer')}</option><option value="cash">{t('pd.fin.cash')}</option><option value="cheque">{t('pd.fin.cheque')}</option><option value="card">{t('pd.fin.card')}</option><option value="other">{t('pd.fin.other')}</option></select></Field><Field label={t('pd.fin.reference')}><Input value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))}/></Field></div><Field label={t('pd.fin.notes')}><Textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/></Field><div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-300">{t('pd.fin.localOnlyNotice')}</div><div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={()=>setOpen(false)}>{t('common.cancel')}</Button><Button type="submit" disabled={busy}>{busy?t('common.saving'):t('pd.fin.addPayment')}</Button></div></form></Modal>}

    {purchaseDetail && <Modal title={`${t('pd.fin.purchase')} #${purchaseDetail.source_reference || purchaseDetail.external_id}`} onClose={()=>setPurchaseDetail(null)}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.date')}</div><div>{purchaseDetail.record_date}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.supplier')}</div><div>{purchaseDetail.party_name||'—'}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.subtotal')}</div><div>{money(purchaseDetail.subtotal)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.vat')}</div><div>{money(purchaseDetail.vat_amount)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.total')}</div><div>{money(purchaseDetail.total_amount)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.amountPaid')}</div><div>{money(purchaseDetail.reflected_paid)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.remaining')}</div><div>{money(purchaseDetail.reflected_balance)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.status')}</div><div>{purchaseDetail.payment_status}</div></div>
        </div>
        {!!(purchaseDetail.raw_payload?.items||[]).length && <div className="overflow-auto"><table className="w-full text-xs"><thead><tr><Th>{t('pd.fin.item')}</Th><Th>{t('pd.fin.code')}</Th><Th>{t('pd.fin.qty')}</Th><Th>{t('pd.fin.unitCost')}</Th><Th>{t('pd.fin.total')}</Th></tr></thead><tbody>{purchaseDetail.raw_payload.items.map((it,i)=><tr key={i}><Td>{it.product_name}</Td><Td>{it.product_code}</Td><Td>{it.quantity}</Td><Td>{it.unit_cost}</Td><Td>{it.total}</Td></tr>)}</tbody></table></div>}
        <div className="flex justify-between gap-2 pt-2">
          {isAdmin ? <Button variant="ghost" onClick={()=>disconnectPurchase(purchaseDetail.id)}>{t('pd.fin.disconnect')}</Button> : <span/>}
          <Button onClick={()=>printPurchase(purchaseDetail)}>{t('common.print')}</Button>
        </div>
      </div>
    </Modal>}

    {paymentDetail && <Modal title={`${t('pd.fin.receivedPayment')} — ${paymentDetail.source_reference || paymentDetail.external_id}`} onClose={()=>setPaymentDetail(null)}>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.invoiceNumber')}</div><div>{paymentDetail.source_reference||paymentDetail.external_id}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.customer')}</div><div>{paymentDetail.party_name||'—'}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.invoiceDate')}</div><div>{paymentDetail.record_date}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.status')}</div><div>{paymentDetail.payment_status}</div></div>
        </div>
        <div className="grid grid-cols-3 gap-3 rounded-lg border border-[color:var(--bd)] p-3 text-center">
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.invoiceTotal')}</div><div className="font-semibold">{money(paymentDetail.total_amount)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.amountPaid')}</div><div className="font-semibold text-emerald-600 dark:text-emerald-400">{money(paymentDetail.reflected_paid)}</div></div>
          <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.remaining')}</div><div className="font-semibold">{money(paymentDetail.reflected_balance)}</div></div>
        </div>
        {!!(paymentDetail.localPayments||[]).length && <div>
          <div className="mb-1 text-xs font-semibold uppercase text-[color:var(--tx-3)]">{t('pd.fin.erpRecordedPayments')}</div>
          <div className="space-y-1">{paymentDetail.localPayments.map(lp => (
            <div key={lp.id} className="flex items-center justify-between rounded-lg border border-[color:var(--bd)] px-3 py-2">
              <span>{lp.payment_date} · {money(lp.amount)} · {lp.payment_method||'—'}{lp.reference?` · ${lp.reference}`:''}</span>
              {isAdmin && <button onClick={()=>deletePayment(lp.id)} title={t('common.delete')} className="text-[#ef4444]">🗑</button>}
            </div>
          ))}</div>
        </div>}
        <div className="rounded-lg border border-[color:var(--bd)] p-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.projectValue') === 'pd.fin.projectValue' ? 'Project Value' : t('pd.fin.projectValue')}</div><div className="font-semibold">{money(projectValue)}</div></div>
            <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.paidAmount') === 'pd.fin.paidAmount' ? 'Paid Amount' : t('pd.fin.paidAmount')}</div><div className="font-semibold">{money(totalReceived)}</div></div>
            <div><div className="text-xs text-[color:var(--tx-3)]">{t('pd.fin.balanceToPay') === 'pd.fin.balanceToPay' ? 'Balance To Pay' : t('pd.fin.balanceToPay')}</div><div className="font-semibold">{money(balanceToPay)}</div></div>
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          {isAdmin ? <Button variant="ghost" onClick={()=>disconnectInvoice(paymentDetail.id)}>{t('pd.fin.disconnect') === 'pd.fin.disconnect' ? 'Disconnect from project' : t('pd.fin.disconnect')}</Button> : <span/>}
          <Button onClick={()=>printPayment(paymentDetail)}>{t('common.print')}</Button>
        </div>
      </div>
    </Modal>}
  </div>;
}

function FinancialMetric({label,value}){return <div className="glass-card p-4"><div className="text-xs text-[color:var(--tx-3)]">{label}</div><div className="mt-2 text-lg font-bold">{value}</div></div>}

function ActivityTab({ projectId }) {
  const { t, formatDate } = useLanguage();
  const { data, error } = useLiveData(`/api/projects/${projectId}/activity`, 15000);
  const rows = data?.activity || [];

  return (
    <div className="glass-card p-4">
      <h3 className="font-medium text-sm mb-3">{t('pd.activity')}</h3>
      {error && <div className="text-sm text-[#ef4444] mb-3">{error}</div>}
      {!data ? (
        <div className="text-sm text-[color:var(--tx-3)] py-6 text-center">{t('common.loading')}</div>
      ) : rows.length === 0 ? (
        <EmptyState text={t('pd.noActivityYet')} />
      ) : (
        <ol className="relative border-s border-[color:var(--bd)] ms-2 space-y-4">
          {rows.map(a => (
            <li key={a.id} className="ms-4">
              <div className="absolute w-2 h-2 rounded-full bg-brand-500 mt-1.5 -start-1" />
              <time className="block text-xs text-[color:var(--tx-3)]">{formatDate(a.created_at, { dateStyle: 'medium', timeStyle: 'short' })}</time>
              <p className="text-sm">{a.activity}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
