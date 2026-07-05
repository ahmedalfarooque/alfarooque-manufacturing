'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLiveData } from '@/lib/useLiveData';
import { ProjectModal } from '@/app/(protected)/projects/page';

const STATUS_BADGE = {
  Running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'On Hold': 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export default function ProjectViewPage() {
  const { id } = useParams();
  const [me, setMe] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadErr, setUploadErr] = useState(null);
  const fileRef = useRef(null);

  const { data, error, refresh } = useLiveData('/api/projects/' + id, 15000);
  const isAdmin = me?.role === 'admin';

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  async function saveProject(form, mode, projectId) {
    const res = await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setEditOpen(false);
    refresh();
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true); setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/projects/${id}/documents`, { method: 'POST', credentials: 'same-origin', body: fd });
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
    const res = await fetch(`/api/projects/${id}/documents/${docId}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setLightbox(null); refresh(); }
  }

  if (error) return <Shell active="/projects"><div className="text-red-500">{error}</div></Shell>;
  if (!data) return <Shell active="/projects"><div className="text-slate-400">Loading…</div></Shell>;

  const { project: p, customer: c, documents } = data;
  const hasValue = p.value != null && Number(p.value) > 0;

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
                      <img src={d.url} alt={d.file_name} className="w-full h-full object-cover" />
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
      </div>

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
