'use client';

import { useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import Dropdown from '@/components/Dropdown';
import { useLiveData } from '@/lib/useLiveData';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useSortableData, SortIndicator } from '@/lib/useSortableData';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Field, Modal, EmptyState, Th, Td } from '@/components/ui';

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
          <p className="text-xs text-[color:var(--tx-3)]">{t('users.breadcrumb')}</p>
        </div>
        <Button onClick={() => setModal({ mode: 'add', data: EMPTY_FORM })}>{t('users.addUser')}</Button>
      </div>

      <div className="glass-card p-4 mb-4">
        <Input placeholder={t('users.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-md" />
      </div>

      {error && <div className="text-sm text-[#ef4444] mb-3">{error}</div>}

      <div className="glass-card overflow-hidden">
        <div className="overflow-auto max-h-[70vh]">
          <table className="w-full text-sm min-w-[950px]">
            <thead className="sticky top-0 z-10 bg-[color:var(--nav-bg)] backdrop-blur-xl">
              <tr>
                <Th><span onClick={() => toggleSort('full_name')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('common.name')}<SortIndicator column="full_name" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('email')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('common.email')}<SortIndicator column="email" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th><span onClick={() => toggleSort('role')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('users.col.role')}<SortIndicator column="role" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th>{t('users.col.position')}</Th>
                <Th>{t('users.col.department')}</Th>
                <Th>{t('users.col.company')}</Th>
                <Th><span onClick={() => toggleSort('status')} className="cursor-pointer select-none inline-flex items-center gap-1 hover:text-[#5b5a52] dark:hover:text-white/80">{t('common.status')}<SortIndicator column="status" sortKey={sortKey} sortDir={sortDir} /></span></Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr><td colSpan={8} className="py-8 text-center text-[color:var(--tx-3)]">{t('common.loading')}</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={8}><EmptyState text={t('users.noUsersYet')} /></td></tr>
              ) : users.map(u => (
                <tr key={u.id} onClick={() => setModal({ mode: 'edit', data: u })}
                  className="cursor-pointer transition-colors duration-150 hover:bg-[color:var(--pr-soft)]">
                  <Td className="font-medium">{u.full_name}</Td>
                  <Td>{u.email}</Td>
                  <Td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (ROLE_BADGE[u.role] || '')}>{t('role.' + u.role)}</span></Td>
                  <Td>{u.position || '—'}</Td>
                  <Td>{u.department || '—'}</Td>
                  <Td>{u.company || '—'}</Td>
                  <Td><span className={'px-2 py-0.5 rounded-full text-[11px] font-medium ' + (STATUS_BADGE[u.status || 'Active'] || '')}>{t('users.status.' + (u.status || 'Active').toLowerCase())}</span></Td>
                  <Td className="text-end whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setModal({ mode: 'edit', data: u })} title={t('common.edit')} className="text-brand-600 dark:text-brand-400 me-3">✎</button>
                    {me && me.id !== u.id && <button onClick={() => deleteUser(u)} title={t('common.delete')} className="text-[#ef4444]">🗑</button>}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-[color:var(--tx-3)] flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span>{t('common.showingEntries', { from: users.length ? (page - 1) * pageSize + 1 : 0, to: (page - 1) * pageSize + users.length, total })}</span>
          <div className="flex items-center gap-1.5">
            <span>{t('common.rows')}</span>
            <Dropdown className="w-20" value={pageSize} onChange={v => { setPageSize(Number(v)); setPage(1); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1">‹</Button>
          <span className="px-3 py-1">{page} / {totalPages}</span>
          <Button variant="ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1">›</Button>
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
      <Modal title={t('users.modal.userCreatedTitle')} onClose={onClose}>
        <div className="space-y-4">
          <p className="text-sm text-[color:var(--tx-3)]">{t('users.modal.userCreatedNote', { name: form.full_name })}</p>
          <div className="rounded-lg border border-[color:var(--bd)] bg-[color:var(--pr-soft)] px-4 py-3 font-mono text-lg text-center select-all">{tempPassword}</div>
          <div className="flex justify-end"><Button onClick={onClose}>{t('common.done')}</Button></div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={modal.mode === 'add' ? t('users.modal.addTitle') : t('users.modal.editTitle')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <div className="text-sm text-[#ef4444]">{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('users.modal.fullName')} required><Input value={form.full_name} onChange={set('full_name')} required /></Field>
          <Field label={t('users.modal.email')} required={modal.mode === 'add'}><Input type="email" value={form.email || ''} onChange={set('email')} disabled={modal.mode === 'edit'} required={modal.mode === 'add'} className="disabled:opacity-70" /></Field>
          <Field label={t('users.modal.role')}>
            <Dropdown value={form.role} onChange={v => setForm(f => ({ ...f, role: v }))}
              options={[['viewer', t('role.viewer')], ['external', t('role.external')], ['admin', t('role.admin')]]} />
          </Field>
          <Field label={t('users.modal.status')}>
            <Dropdown value={form.status || 'Active'} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={[['Active', t('users.status.active')], ['Inactive', t('users.status.inactive')], ['Blocked', t('users.status.blocked')]]} />
          </Field>
          <Field label={t('users.modal.phone')}><Input value={form.phone || ''} onChange={set('phone')} /></Field>
          <Field label={t('users.modal.position')}><Input value={form.position || ''} onChange={set('position')} /></Field>
          <Field label={t('users.modal.department')}><Input value={form.department || ''} onChange={set('department')} /></Field>
          <Field label={t('users.modal.company')}><Input value={form.company || ''} onChange={set('company')} /></Field>
        </div>
        {modal.mode === 'add' && form.role !== 'admin' && (
          <p className="text-xs text-[color:var(--tx-3)]">{t('users.modal.otpNote')}</p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={busy}>{busy ? t('common.saving') : t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
