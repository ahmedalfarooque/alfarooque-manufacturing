'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage } from '@/lib/i18n';
import { GlassButton, GlassIconButton } from '@/components/glass';

const EMPTY_FORM = { full_name: '', email: '', position: '', role: 'viewer', phone: '', department: '', company: '', status: 'Active', otp_login_enabled: true };
const ROLE_BADGE = {
  admin: 'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  viewer: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  external: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};
const STATUS_BADGE = {
  Active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Inactive: 'bg-slate-500/10 text-slate-500',
  Blocked: 'bg-red-500/10 text-red-600 dark:text-red-400',
};
const REFRESH_MS = 15000;

export default function UsersPage() {
  const { t } = useLanguage();
  const [me, setMe] = useState(null);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [modal, setModal] = useState(null); // { mode: 'add'|'edit', data }
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user)).catch(() => {});
  }, []);

  const { data, error, refresh } = useLiveData('/api/users', REFRESH_MS);
  const allUsers = data?.users || [];
  const filtered = debouncedSearch
    ? allUsers.filter(u => [u.full_name, u.email, u.position, u.department, u.company].some(v => (v || '').toLowerCase().includes(debouncedSearch.toLowerCase())))
    : allUsers;
  const { sorted, sortKey, sortDir, toggleSort } = useSortableData(filtered);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const users = sorted.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  async function saveUser(form, mode, id) {
    const url = mode === 'add' ? '/api/users' : `/api/users/${id}`;
    const res = await fetch(url, {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const respData = await res.json();
    if (!res.ok) throw new Error(respData.error);
    setModal(null);
    refresh();
    return respData;
  }

  async function deleteUser(u) {
    if (!confirm(t('users.deleteConfirm') || 'This user will be permanently deleted. Are you sure?')) return;
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) refresh();
    else { const d = await res.json().catch(() => ({})); alert(d.error || 'Could not delete user.'); }
  }

  return (
    <Shell active="/users">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t('users.title')}</h2>
          <p className="text-xs text-slate-500">{t('users.breadcrumb')}</p>
        </div>
        <GlassButton variant="primary" onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })} className="text-sm px-3 py-2">{t('users.addUser')}</GlassButton>
      </div>

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] p-4 mb-4">
        <input placeholder={t('users.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm" />
      </div>

      {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

      <div className="rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-white/[0.03] overflow-auto max-h-[70vh]">
        <table className="w-full text-sm min-w-[950px]">
          <thead className="text-left text-slate-400 text-xs border-b border-black/5 dark:border-white/10 sticky top-0 z-10 bg-white dark:bg-[#0f172a]">
            <tr>
              <th onClick={() => toggleSort('full_name')} className="py-3 px-4 cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('common.name')}<SortIndicator column="full_name" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('email')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('common.email')}<SortIndicator column="email" sortKey={sortKey} sortDir={sortDir} /></th>
              <th onClick={() => toggleSort('role')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('users.col.role')}<SortIndicator column="role" sortKey={sortKey} sortDir={sortDir} /></th>
              <th>{t('users.col.position')}</th>
              <th>{t('users.col.department')}</th>
              <th>{t('users.col.company')}</th>
              <th onClick={() => toggleSort('status')} className="cursor-pointer select-none hover:text-slate-600 dark:hover:text-slate-200">{t('common.status')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></th>
              <th className="text-right px-4">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('common.loading')}</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="py-8 text-center text-slate-400">{t('users.noUsersYet')}</td></tr>
            ) : users.map(u => (
              <tr key={u.id} onClick={() => setModal({ mode: 'edit', data: u })}
                className="border-b border-black/5 dark:border-white/5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors duration-150">
                <td className="py-3 px-4 font-medium">{u.full_name}</td>
                <td>{u.email}</td>
                <td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (ROLE_BADGE[u.role] || '')}>{t('role.' + u.role)}</span></td>
                <td>{u.position || '—'}</td>
                <td>{u.department || '—'}</td>
                <td>{u.company || '—'}</td>
                <td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (STATUS_BADGE[u.status || 'Active'] || '')}>{t('users.status.' + (u.status || 'Active').toLowerCase())}</span></td>
                <td className="text-right px-4 space-x-2" onClick={e => e.stopPropagation()}>
                  <GlassIconButton onClick={() => setModal({ mode: 'edit', data: u })} title={t('common.edit')} tone="cyan">✎</GlassIconButton>
                  {me && me.id !== u.id && <GlassIconButton onClick={() => deleteUser(u)} title={t('common.delete')} tone="red">🗑</GlassIconButton>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-slate-500 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('common.showingEntries', { from: users.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + users.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('common.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <GlassButton variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1">‹</GlassButton>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <GlassButton variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1">›</GlassButton>
        </div>
      </div>

      {modal && <UserModal modal={modal} onClose={() => setModal(null)} onSave={saveUser} />}
    </Shell>
  );
}

function UserModal({ modal, onClose, onSave }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ ...EMPTY_FORM, ...modal.data });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const result = await onSave(form, modal.mode, modal.data.id);
      if (result?.temp_password) setTempPassword(result.temp_password);
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  }

  if (tempPassword) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <h3 className="font-semibold text-lg">{t('users.modal.userCreatedTitle')}</h3>
          <p className="text-sm text-slate-500">{t('users.modal.userCreatedNote', { name: form.full_name })}</p>
          <div className="rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 px-4 py-3 font-mono text-lg text-center select-all">{tempPassword}</div>
          <div className="flex justify-end"><GlassButton variant="primary" onClick={onClose} className="px-4 py-2 text-sm">{t('common.done')}</GlassButton></div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#0f172a] p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-lg">{modal.mode === 'add' ? t('users.modal.addTitle') : t('users.modal.editTitle')}</h3>
        {err && <div className="text-red-500 text-sm">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('users.modal.fullName')} value={form.full_name} onChange={set('full_name')} required />
          <Field label={t('users.modal.email')} type="email" value={form.email || ''} onChange={set('email')} disabled={modal.mode === 'edit'} required={modal.mode === 'add'} />
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('users.modal.role')}</label>
            <Dropdown value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))}
              options={[['viewer', t('role.viewer')], ['external', t('role.external')], ['admin', t('role.admin')]]} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('users.modal.status')}</label>
            <Dropdown value={form.status || 'Active'} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={[['Active', t('users.status.active')], ['Inactive', t('users.status.inactive')], ['Blocked', t('users.status.blocked')]]} />
          </div>
          <Field label={t('users.modal.phone')} value={form.phone || ''} onChange={set('phone')} />
          <Field label={t('users.modal.position')} value={form.position || ''} onChange={set('position')} />
          <Field label={t('users.modal.department')} value={form.department || ''} onChange={set('department')} />
          <Field label={t('users.modal.company')} value={form.company || ''} onChange={set('company')} />
        </div>
        {modal.mode === 'add' && form.role !== 'admin' && (
          <p className="text-xs text-slate-500">{t('users.modal.otpNote')}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <GlassButton type="button" variant="secondary" onClick={onClose} className="px-4 py-2 text-sm">{t('common.cancel')}</GlassButton>
          <GlassButton variant="primary" disabled={busy} className="px-4 py-2 text-sm">{busy ? t('common.saving') : t('common.save')}</GlassButton>
        </div>
      </form>
    </div>
  );
}
function Field({ label, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input {...props} className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm disabled:opacity-70" />
    </div>
  );
}
