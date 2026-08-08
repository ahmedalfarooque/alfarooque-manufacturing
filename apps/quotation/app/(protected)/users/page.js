'use client';

import { useCallback, useEffect, useState } from 'react';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { Select, EmptyState, Th, Td } from '@/components/ui';
import { GlassIconButton } from '@/components/glass';

const ROLES = ['admin', 'manager', 'sales', 'estimator', 'accountant', 'production', 'readonly'];
const PERMS = {
  admin: ['write', 'approve', 'costs', 'reports', 'admin'],
  manager: ['write', 'approve', 'costs', 'reports'],
  sales: ['write', 'reports'],
  estimator: ['write', 'costs'],
  accountant: ['reports', 'costs'],
  production: [],
  readonly: [],
};
const ALL_PERMS = ['write', 'approve', 'costs', 'reports', 'admin'];

export default function UsersPage() {
  const { t, formatDate } = useLanguage();
  const [rows, setRows] = useState(null);
  const [msg, setMsg] = useState(null);
  const [me, setMe] = useState(null);

  const load = useCallback(() => {
    fetch('/api/admin/users', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] })
      .then(d => setRows(d.rows || []))
      .catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : null).then(d => d && setMe(d.user || d)).catch(() => {});
  }, []);

  async function deleteUser(u) {
    if (!confirm(t('users.deleteConfirm'))) return;
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) load();
    else { const d = await res.json().catch(() => ({})); setMsg('⚠ ' + (d.error || t('common.genericError'))); }
  }

  async function setRole(user, role) {
    setMsg(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ user_id: user.id, role }),
    }).catch(() => null);
    if (res && res.ok) { setMsg(t('users.roleSaved', { email: user.email })); load(); }
    else setMsg('⚠ ' + t('common.genericError'));
  }

  return (
    <Shell active="/users">
      <div className="space-y-4">
        {msg && <div className="rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{msg}</div>}
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr>
                <Th>{t('f.name')}</Th><Th>{t('f.email')}</Th><Th>{t('users.platformRole')}</Th>
                <Th>{t('users.qrole')}</Th><Th>{t('users.since')}</Th><Th className="text-end">{t('common.actions')}</Th>
              </tr></thead>
              <tbody>
                {rows === null ? (
                  <tr><Td colSpan={6} className="text-center text-[#7C9296]">{t('shell.loading')}</Td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={6}><EmptyState text={t('common.noRecords')} /></td></tr>
                ) : rows.map(u => (
                  <tr key={u.id}>
                    <Td>{u.full_name || '—'}</Td>
                    <Td dir="ltr">{u.email}</Td>
                    <Td>{t('role.' + u.role)}</Td>
                    <Td>
                      {u.platform_admin ? (
                        <span className="text-[12px] px-2 py-0.5 rounded-full bg-brand-600/15 text-brand-700 dark:text-brand-300">{t('qrole.admin')}</span>
                      ) : (
                        <Select value={u.qrole} onChange={e => setRole(u, e.target.value)} className="max-w-[180px] !py-1"
                          options={ROLES.map(r => ({ value: r, label: t('qrole.' + r) }))} />
                      )}
                    </Td>
                    <Td className="text-[12px] text-[#7C9296] whitespace-nowrap">{formatDate(u.created_at)}</Td>
                    <Td className="text-end whitespace-nowrap">
                      {me && me.id !== u.id && (
                        <GlassIconButton tone="red" title={t('common.delete')} onClick={() => deleteUser(u)}>🗑</GlassIconButton>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Permission matrix legend */}
        <div className="glass-card p-4 overflow-x-auto">
          <div className="font-semibold text-sm mb-3">{t('users.matrix')}</div>
          <table className="w-full text-sm">
            <thead><tr>
              <Th>{t('users.qrole')}</Th>
              {ALL_PERMS.map(p => <Th key={p}>{t('perm.' + p)}</Th>)}
            </tr></thead>
            <tbody>
              {ROLES.map(r => (
                <tr key={r}>
                  <Td className="font-medium">{t('qrole.' + r)}</Td>
                  {ALL_PERMS.map(p => (
                    <Td key={p} className="text-center">{PERMS[r].includes(p) ? '✓' : '—'}</Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
