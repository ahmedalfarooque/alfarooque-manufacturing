'use client';

/* Shared Users/Role-Permissions workspace — identical across all six apps
   (QuotePro/Projects/Cars/Inventory/Accounting/CRM), only `appId` differs.
   Previously had ZERO i18n integration — every string was hardcoded
   English regardless of the app's language setting (a real gap found
   during the interior-page parity audit). Since this component's content
   doesn't vary per app, a small local EN/AR dictionary keyed by the
   `lang` prop (already passed in by each app's own i18n system, not a
   new mechanism) is simpler and less error-prone than duplicating ~30
   keys across six separate translation files. Falls back to the
   caller's own `t()` first when a key exists there, so nothing breaks if
   an app's own i18n later grows a matching key. */

import { useEffect, useMemo, useState } from 'react';

const APP_LABELS = { quotation: 'QuotePro', projects: 'Projects', cars: 'Cars', inventory: 'Inventory', accounting: 'Accounting', crm: 'CRM' };

const STRINGS = {
  en: {
    title: 'Users', subtitle: 'User and role management · {app}', addUser: '+ Add User',
    loadError: 'Could not load users.', saveError: 'Could not save user.',
    confirmDelete: 'Delete {name}?', deleteError: 'Could not delete user.', deleted: 'User deleted.',
    colName: 'Name', colEmail: 'Email', colApp: 'Platform / Application', colRole: 'Role',
    colApproved: 'Admin Approved', colSince: 'Since', colActions: 'Actions', loading: 'Loading…',
    moduleAccess: 'Module Access', delete: 'Delete',
    rolePermissions: 'Role Permissions', rolePermSubtitle: 'Permissions are saved independently for {app}.',
    colRole2: 'Role', colPermissions: 'Permissions', colAction: 'Action',
    fullAccess: 'Full Access', custom: 'Custom', edit: 'Edit',
    addUserTitle: 'Add User', name: 'Name', email: 'Email', role: 'Role', adminApproved: 'Admin Approved',
    appAccess: 'Application access', cancel: 'Cancel', save: 'Save', saving: 'Saving…',
    createError: 'Could not create user.', existingIdentityGranted: 'Existing identity granted application access.',
    userCreatedTempPassword: 'User created. Temporary password: {pwd}',
    moduleAccessTitle: '{name} · Module Access', moduleAccessSaveError: 'Could not save module access.',
    moduleAccessSaved: 'Module access saved.',
    roleAdmin: 'Admin', roleManager: 'Manager', roleSales: 'Sales', roleEstimator: 'Estimator',
    roleAccountant: 'Accountant', roleProduction: 'Production', roleReadonly: 'Read Only',
    levelViewOnly: 'View Only', levelViewEdit: 'View & Edit', levelFullAccess: 'Full Access',
  },
  ar: {
    title: 'المستخدمون', subtitle: 'إدارة المستخدمين والصلاحيات · {app}', addUser: '+ إضافة مستخدم',
    loadError: 'تعذر تحميل المستخدمين.', saveError: 'تعذر حفظ المستخدم.',
    confirmDelete: 'حذف {name}؟', deleteError: 'تعذر حذف المستخدم.', deleted: 'تم حذف المستخدم.',
    colName: 'الاسم', colEmail: 'البريد الإلكتروني', colApp: 'المنصة / التطبيق', colRole: 'الدور',
    colApproved: 'موافقة المسؤول', colSince: 'منذ', colActions: 'الإجراءات', loading: 'جارٍ التحميل…',
    moduleAccess: 'صلاحيات الوحدات', delete: 'حذف',
    rolePermissions: 'صلاحيات الأدوار', rolePermSubtitle: 'يتم حفظ الصلاحيات بشكل مستقل لـ {app}.',
    colRole2: 'الدور', colPermissions: 'الصلاحيات', colAction: 'إجراء',
    fullAccess: 'وصول كامل', custom: 'مخصص', edit: 'تعديل',
    addUserTitle: 'إضافة مستخدم', name: 'الاسم', email: 'البريد الإلكتروني', role: 'الدور', adminApproved: 'موافقة المسؤول',
    appAccess: 'الوصول إلى التطبيقات', cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…',
    createError: 'تعذر إنشاء المستخدم.', existingIdentityGranted: 'تم منح الهوية الحالية صلاحية الوصول إلى التطبيق.',
    userCreatedTempPassword: 'تم إنشاء المستخدم. كلمة المرور المؤقتة: {pwd}',
    moduleAccessTitle: '{name} · صلاحيات الوحدات', moduleAccessSaveError: 'تعذر حفظ صلاحيات الوحدات.',
    moduleAccessSaved: 'تم حفظ صلاحيات الوحدات.',
    roleAdmin: 'مسؤول', roleManager: 'مدير', roleSales: 'مبيعات', roleEstimator: 'مقدّر تكاليف',
    roleAccountant: 'محاسب', roleProduction: 'إنتاج', roleReadonly: 'قراءة فقط',
    levelViewOnly: 'عرض فقط', levelViewEdit: 'عرض وتعديل', levelFullAccess: 'وصول كامل',
  },
};

function makeTr(lang, t) {
  const dict = STRINGS[lang === 'ar' ? 'ar' : 'en'];
  return (key, vars) => {
    let str = dict[key] ?? key;
    if (t) { const viaApp = t('users.' + key); if (viaApp && viaApp !== 'users.' + key) str = viaApp; }
    if (vars) for (const k of Object.keys(vars)) str = str.replace(`{${k}}`, vars[k]);
    return str;
  };
}

const ROLE_KEYS = { admin: 'roleAdmin', manager: 'roleManager', sales: 'roleSales', estimator: 'roleEstimator', accountant: 'roleAccountant', production: 'roleProduction', readonly: 'roleReadonly' };
const LEVEL_KEYS = { view_only: 'levelViewOnly', view_edit: 'levelViewEdit', full_access: 'levelFullAccess' };

function Modal({ title, children, onClose }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="text-xl text-[color:var(--tx-3)]">×</button></div>
      {children}
    </div>
  </div>;
}

export default function UsersWorkspace({ appId, t, lang = 'en' }) {
  const tr = useMemo(() => makeTr(lang, t), [lang, t]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [accessUser, setAccessUser] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || tr('loadError')); return; }
    setData(body);
  }
  useEffect(() => { load(); }, [appId]);

  async function patchUser(body) {
    setBusy(true); setError('');
    const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    const result = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) throw new Error(result.error || tr('saveError'));
    await load();
  }

  async function removeUser(user) {
    if (!confirm(tr('confirmDelete', { name: user.full_name || user.email }))) return;
    const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE', credentials: 'same-origin' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) { setError(body.error || tr('deleteError')); return; }
    setMessage(tr('deleted')); load();
  }

  const roleLabel = role => tr(ROLE_KEYS[role] || role);

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{tr('title')}</h2><p className="text-sm text-[color:var(--tx-3)]">{tr('subtitle', { app: APP_LABELS[appId] })}</p></div>
      <button onClick={() => setAdding(true)} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">{tr('addUser')}</button>
    </div>
    {message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">{message}</div>}
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</div>}

    <section className="overflow-hidden rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm">
        <thead className="bg-[color:var(--nav-bg)] text-start text-xs uppercase tracking-wide text-[color:var(--tx-3)]"><tr>
          {[tr('colName'), tr('colEmail'), tr('colApp'), tr('colRole'), tr('colApproved'), tr('colSince'), tr('colActions')].map(h => <th key={h} className="px-4 py-3 text-start">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-[color:var(--bd)]">
          {!data ? <tr><td colSpan="7" className="px-4 py-10 text-center text-[color:var(--tx-3)]">{tr('loading')}</td></tr> : data.rows.map(user => <tr key={user.id} className="hover:bg-cyan-500/5">
            <td className="px-4 py-3 font-medium">{user.full_name || '—'}</td><td className="px-4 py-3" dir="ltr">{user.email}</td>
            <td className="px-4 py-3">{APP_LABELS[appId]}</td>
            <td className="px-4 py-3"><select disabled={user.platform_admin || busy} value={user.app_role} onChange={e => patchUser({ user_id: user.id, app_id: appId, role: e.target.value }).catch(e2 => setError(e2.message))} className="rounded-lg border border-[color:var(--bd)] bg-[color:var(--bg-card)] px-2 py-1">
              {(data.roles || []).map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
            </select></td>
            <td className="px-4 py-3"><input type="checkbox" checked={user.platform_admin || !!user.is_approved} disabled={user.platform_admin || busy} onChange={e => patchUser({ user_id: user.id, is_approved: e.target.checked }).catch(e2 => setError(e2.message))} /></td>
            <td className="px-4 py-3 whitespace-nowrap text-[color:var(--tx-3)]">{user.created_at ? new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US') : '—'}</td>
            <td className="px-4 py-3 whitespace-nowrap"><button onClick={() => setAccessUser(user)} className="me-3 text-cyan-600 hover:underline">{tr('moduleAccess')}</button>{!user.platform_admin && <button onClick={() => removeUser(user)} className="text-red-500 hover:underline">{tr('delete')}</button>}</td>
          </tr>)}
        </tbody>
      </table></div>
    </section>

    <section className="rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] p-4">
      <h3 className="mb-1 font-semibold">{tr('rolePermissions')}</h3><p className="mb-4 text-sm text-[color:var(--tx-3)]">{tr('rolePermSubtitle', { app: APP_LABELS[appId] })}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="text-start text-xs uppercase text-[color:var(--tx-3)]"><tr><th className="px-3 py-2 text-start">{tr('colRole2')}</th><th className="px-3 py-2 text-start">{tr('colPermissions')}</th><th className="px-3 py-2 text-end">{tr('colAction')}</th></tr></thead>
        <tbody className="divide-y divide-[color:var(--bd)]">{(data?.roles || []).map(role => <tr key={role}><td className="px-3 py-3 font-medium">{roleLabel(role)}</td><td className="px-3 py-3 text-[color:var(--tx-3)]">{role === 'admin' ? tr('fullAccess') : tr('custom')}</td><td className="px-3 py-3 text-end"><a href={`/users/roles/${role}`} className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-cyan-600 hover:bg-cyan-500/10">{tr('edit')}</a></td></tr>)}</tbody>
      </table></div>
    </section>

    {adding && <AddUserModal appId={appId} roles={data?.roles || []} apps={data?.apps || []} tr={tr} roleLabel={roleLabel} onClose={() => setAdding(false)} onCreated={(result) => { setAdding(false); setMessage(result.reused_identity ? tr('existingIdentityGranted') : tr('userCreatedTempPassword', { pwd: result.temp_password })); load(); }} />}
    {accessUser && <AccessModal appId={appId} user={accessUser} modules={data?.modules || []} tr={tr} onClose={() => setAccessUser(null)} onSave={async module_access => { await patchUser({ user_id: accessUser.id, app_id: appId, module_access }); setAccessUser(null); setMessage(tr('moduleAccessSaved')); }} />}
  </div>;
}

function AddUserModal({ appId, roles, apps, tr, roleLabel, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'readonly', is_approved: false });
  const [selectedApps, setSelectedApps] = useState([appId]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...form, app_access: selectedApps.map(id => ({ app_id: id, role: form.role })) }) });
    const body = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) { setError(body.error || tr('createError')); return; } onCreated(body);
  }
  return <Modal title={tr('addUserTitle')} onClose={onClose}><form onSubmit={submit} className="space-y-4">
    {error && <div className="text-sm text-red-500">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{tr('name')}<input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className="mt-1 w-full rounded-xl border border-[color:var(--bd)] bg-transparent px-3 py-2" /></label><label className="text-sm">{tr('email')}<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-xl border border-[color:var(--bd)] bg-transparent px-3 py-2" /></label>
      <label className="text-sm">{tr('role')}<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="mt-1 w-full rounded-xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] px-3 py-2">{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
      <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" checked={form.is_approved} onChange={e => setForm({ ...form, is_approved: e.target.checked })} /> {tr('adminApproved')}</label></div>
    <div><div className="mb-2 text-sm font-medium">{tr('appAccess')}</div><div className="grid gap-2 sm:grid-cols-3">{apps.map(id => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedApps.includes(id)} onChange={() => setSelectedApps(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id])} />{APP_LABELS[id]}</label>)}</div></div>
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-[color:var(--bd)] px-4 py-2">{tr('cancel')}</button><button disabled={busy || !selectedApps.length} className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? tr('saving') : tr('save')}</button></div>
  </form></Modal>;
}

function AccessModal({ appId, user, modules, tr, onClose, onSave }) {
  const initial = useMemo(() => Object.fromEntries(modules.map(module => [module.id, user.module_access?.[module.id] || 'view_only'])), [modules, user]);
  const [levels, setLevels] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save() {
    setBusy(true); setError('');
    try { await onSave(levels); }
    catch (e) { setError(e.message || tr('moduleAccessSaveError')); }
    finally { setBusy(false); }
  }
  return <Modal title={tr('moduleAccessTitle', { name: user.full_name || user.email })} onClose={onClose}>{error && <div className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}<div className="space-y-2">{modules.map(module => <div key={module.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--bd)] px-3 py-2"><div><div className="text-sm font-medium">{module.label}</div><div className="text-xs capitalize text-[color:var(--tx-3)]">{module.category}</div></div><select value={levels[module.id]} disabled={module.id === 'users' || busy} onChange={e => setLevels({ ...levels, [module.id]: e.target.value })} className="rounded-lg border border-[color:var(--bd)] bg-[color:var(--bg-card)] px-2 py-1 text-sm">{Object.entries(LEVEL_KEYS).map(([value,key]) => <option key={value} value={value}>{tr(key)}</option>)}</select></div>)}</div>
    <div className="mt-4 flex justify-end gap-2"><button disabled={busy} onClick={onClose} className="rounded-xl border border-[color:var(--bd)] px-4 py-2 disabled:opacity-50">{tr('cancel')}</button><button disabled={busy} onClick={save} className="rounded-xl bg-cyan-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? tr('saving') : tr('save')}</button></div>
  </Modal>;
}
