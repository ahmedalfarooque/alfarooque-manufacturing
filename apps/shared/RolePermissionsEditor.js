'use client';

/* Shared Role-Permissions editor — same i18n approach as UsersWorkspace.js
   (a local EN/AR dictionary keyed by the `lang` prop, since this
   component's content is identical across all six apps). Previously
   entirely hardcoded English with a real RTL bug (`text-left` on both
   table header cells regardless of direction). */

import { useEffect, useMemo, useState } from 'react';

const STRINGS = {
  en: {
    title: 'Group Permissions', subtitle: '{role} · application-specific permissions',
    cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    loadError: 'Could not load permissions.', saveError: 'Could not save permissions.',
    colModule: 'Module Name', colView: 'View', colAdd: 'Add', colEdit: 'Edit', colDelete: 'Delete',
    colMisc: 'Miscellaneous', loading: 'Loading…',
    roleAdmin: 'Admin', roleManager: 'Manager', roleSales: 'Sales', roleEstimator: 'Estimator',
    roleAccountant: 'Accountant', roleProduction: 'Production', roleReadonly: 'Read Only',
  },
  ar: {
    title: 'صلاحيات المجموعة', subtitle: '{role} · صلاحيات خاصة بالتطبيق',
    cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…',
    loadError: 'تعذر تحميل الصلاحيات.', saveError: 'تعذر حفظ الصلاحيات.',
    colModule: 'اسم الوحدة', colView: 'عرض', colAdd: 'إضافة', colEdit: 'تعديل', colDelete: 'حذف',
    colMisc: 'إضافي', loading: 'جارٍ التحميل…',
    roleAdmin: 'مسؤول', roleManager: 'مدير', roleSales: 'مبيعات', roleEstimator: 'مقدّر تكاليف',
    roleAccountant: 'محاسب', roleProduction: 'إنتاج', roleReadonly: 'قراءة فقط',
  },
};
const ROLE_KEYS = { admin: 'roleAdmin', manager: 'roleManager', sales: 'roleSales', estimator: 'roleEstimator', accountant: 'roleAccountant', production: 'roleProduction', readonly: 'roleReadonly' };

function makeTr(lang, t) {
  const dict = STRINGS[lang === 'ar' ? 'ar' : 'en'];
  return (key, vars) => {
    let str = dict[key] ?? key;
    if (t) { const viaApp = t('rolePerms.' + key); if (viaApp && viaApp !== 'rolePerms.' + key) str = viaApp; }
    if (vars) for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, vars[k]);
    return str;
  };
}

export default function RolePermissionsEditor({ appId, role, t, lang = 'en' }) {
  const tr = useMemo(() => makeTr(lang, t), [lang, t]);
  const roleLabel = tr(ROLE_KEYS[role] || role);
  const [rows, setRows] = useState(null); const [savedRows, setSavedRows] = useState(null);
  const [tab, setTab] = useState('all'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/admin/role-permissions/${role}`, { credentials: 'same-origin' }).then(async res => {
      const body = await res.json().catch(() => ({})); if (!res.ok) throw new Error(body.error || tr('loadError'));
      setRows(body.permissions); setSavedRows(JSON.parse(JSON.stringify(body.permissions)));
    }).catch(e => setError(e.message));
  }, [appId, role]);
  const categories = useMemo(() => ['all', ...new Set((rows || []).map(row => row.category))], [rows]);
  function toggle(moduleId, action) {
    setRows(list => list.map(row => {
      if (row.id !== moduleId) return row;
      const next = !row[action];
      if (action === 'view' && !next) return { ...row, view: false, add: false, edit: false, delete: false };
      if (action !== 'view' && next) return { ...row, view: true, [action]: true };
      return { ...row, [action]: next };
    }));
  }
  function cancel() { setRows(savedRows); window.location.href = '/users'; }
  async function save() {
    setBusy(true); setError('');
    const res = await fetch(`/api/admin/role-permissions/${role}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ permissions: rows.map(row => ({ module_id: row.id, view: row.view, add: row.add, edit: row.edit, delete: row.delete, miscellaneous: row.miscellaneous || {} })) }) });
    const body = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setError(body.error || tr('saveError')); return; }
    window.location.href = '/users';
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">{tr('title')}</h2><p className="text-sm text-[color:var(--tx-3)]">{tr('subtitle', { role: roleLabel })}</p></div><div className="flex gap-2"><button onClick={cancel} className="rounded-xl border border-[color:var(--bd)] px-4 py-2">{tr('cancel')}</button><button onClick={save} disabled={!rows || busy} className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? tr('saving') : tr('save')}</button></div></div>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</div>}
    <div className="flex gap-2 overflow-x-auto pb-1">{categories.map(category => <button key={category} onClick={() => setTab(category)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm capitalize ${tab === category ? 'bg-cyan-600 text-white' : 'border border-[color:var(--bd)] text-[color:var(--tx-2)]'}`}>{category}</button>)}</div>
    <section className="overflow-hidden rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)]"><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-[color:var(--nav-bg)] text-xs uppercase text-[color:var(--tx-3)]"><tr><th className="px-4 py-3 text-start">{tr('colModule')}</th>{[tr('colView'), tr('colAdd'), tr('colEdit'), tr('colDelete')].map(action => <th key={action} className="px-4 py-3 text-center">{action}</th>)}<th className="px-4 py-3 text-start">{tr('colMisc')}</th></tr></thead>
      <tbody className="divide-y divide-[color:var(--bd)]">{!rows ? <tr><td colSpan="6" className="px-4 py-10 text-center">{tr('loading')}</td></tr> : rows.filter(row => tab === 'all' || row.category === tab).map(row => <tr key={row.id}><td className="px-4 py-3"><div className="font-medium">{row.label}</div><div className="text-xs capitalize text-[color:var(--tx-3)]">{row.category}</div></td>{['view','add','edit','delete'].map(action => <td key={action} className="px-4 py-3 text-center"><input type="checkbox" checked={!!row[action]} disabled={role === 'admin' || row.id === 'users' && role !== 'admin'} onChange={() => toggle(row.id, action)} /></td>)}<td className="px-4 py-3 text-[color:var(--tx-3)]">{Object.keys(row.miscellaneous || {}).length ? Object.keys(row.miscellaneous).join(', ') : '—'}</td></tr>)}</tbody>
    </table></div></section>
  </div>;
}
