'use client';

/* Shared Users/Role-Permissions workspace — identical across all six apps
   (QuotePro/Projects/Cars/Inventory/Accounting/CRM), only `appId` differs.
   Talks to the shared admin handlers (userAdminHandlers.js) and the
   shared permission registry; it never defines its own permission model.

   i18n: a local EN/AR dictionary keyed by the `lang` prop (already passed
   in by each app's own i18n system). Falls back to the caller's own `t()`
   first when a key exists there (`users.<key>`), so an app can override
   any string without touching this file.

   Role model (shared registry): Admin = platform-wide full control;
   Manager = full operational access, no user administration; Read Only =
   view; anything else = per-module overrides ("Module Access"). A user
   with no grant for this app cannot use it at all — assigning a role
   creates the grant. */

import { useEffect, useMemo, useState } from 'react';

const APP_LABELS = { quotation: 'QuotePro', projects: 'Projects', cars: 'Cars', inventory: 'Inventory', accounting: 'Accounting', crm: 'CRM' };

const STRINGS = {
  en: {
    title: 'Users', subtitle: 'User and role management · {app}', addUser: '+ Add User',
    loadError: 'Could not load users.', saveError: 'Could not save user.', networkError: 'Could not reach the server. Check your connection and try again.',
    confirmDelete: 'Permanently delete {name}? This cannot be undone. Prefer "Deactivate" to keep history.', deleteError: 'Could not delete user.', deleted: 'User deleted.',
    confirmDeactivate: 'Deactivate {name}? They will no longer be able to sign in.', deactivated: 'User deactivated.', activated: 'User activated.',
    colName: 'Name', colEmail: 'Email', colApp: 'Access · {app}', colRole: 'Role', colStatus: 'Status',
    colApproved: 'Approved', colSince: 'Since', colActions: 'Actions', loading: 'Loading users…', empty: 'No users yet. Add the first user to grant access.',
    moduleAccess: 'Module Access', delete: 'Delete', deactivate: 'Deactivate', activate: 'Activate', editName: 'Edit',
    statusActive: 'Active', statusInactive: 'Inactive', platformAdmin: 'Platform admin',
    hasAccess: 'Has access', noAccess: 'No access', noAccessHint: 'Assign a role to grant access to {app}.', custom: 'Custom',
    revokeAccess: 'Revoke access', confirmRevoke: 'Remove {name}’s access to {app}? They keep access to other applications.', revoked: 'Access to {app} removed.', accessGranted: 'Role saved — access to {app} granted.',
    rolePermissions: 'Role Permissions', rolePermSubtitle: 'Permissions are saved independently for {app}.',
    roleLegend: 'Admin: full control · Manager: full operational access, no user administration · Read Only: view only · Module Access: custom per-module permissions.',
    colRole2: 'Role', colPermissions: 'Permissions', colAction: 'Action',
    fullAccess: 'Full Access', edit: 'Edit',
    addUserTitle: 'Add User', editUserTitle: 'Edit User', name: 'Name', email: 'Email', role: 'Role', adminApproved: 'Admin Approved',
    appAccess: 'Application access', cancel: 'Cancel', save: 'Save', saving: 'Saving…', close: 'Close',
    createError: 'Could not create user.', existingIdentityGranted: 'Existing identity granted application access.',
    userCreatedTempPassword: 'User created. Temporary password: {pwd}', tempPasswordHint: 'Share it securely — it is shown once and must be changed at first login.',
    moduleAccessTitle: '{name} · Module Access', moduleAccessSaveError: 'Could not save module access.',
    moduleAccessSaved: 'Module access saved.', nameSaved: 'User updated.',
    roleAdmin: 'Admin', roleManager: 'Manager', roleSales: 'Sales', roleEstimator: 'Estimator',
    roleAccountant: 'Accountant', roleProduction: 'Production', roleReadonly: 'Read Only',
    levelViewOnly: 'View Only', levelViewEdit: 'View & Edit', levelFullAccess: 'Full Access',
    roleFor: 'Role for {name}', approvedFor: 'Admin approved: {name}',
  },
  ar: {
    title: 'المستخدمون', subtitle: 'إدارة المستخدمين والصلاحيات · {app}', addUser: '+ إضافة مستخدم',
    loadError: 'تعذر تحميل المستخدمين.', saveError: 'تعذر حفظ المستخدم.', networkError: 'تعذر الوصول إلى الخادم. تحقق من الاتصال وحاول مرة أخرى.',
    confirmDelete: 'حذف {name} نهائيًا؟ لا يمكن التراجع. يُفضَّل "إيقاف" للاحتفاظ بالسجل.', deleteError: 'تعذر حذف المستخدم.', deleted: 'تم حذف المستخدم.',
    confirmDeactivate: 'إيقاف {name}؟ لن يتمكن من تسجيل الدخول.', deactivated: 'تم إيقاف المستخدم.', activated: 'تم تفعيل المستخدم.',
    colName: 'الاسم', colEmail: 'البريد الإلكتروني', colApp: 'الوصول · {app}', colRole: 'الدور', colStatus: 'الحالة',
    colApproved: 'معتمد', colSince: 'منذ', colActions: 'الإجراءات', loading: 'جارٍ تحميل المستخدمين…', empty: 'لا يوجد مستخدمون بعد. أضف أول مستخدم لمنح الوصول.',
    moduleAccess: 'صلاحيات الوحدات', delete: 'حذف', deactivate: 'إيقاف', activate: 'تفعيل', editName: 'تعديل',
    statusActive: 'نشط', statusInactive: 'موقوف', platformAdmin: 'مسؤول المنصة',
    hasAccess: 'لديه وصول', noAccess: 'لا يوجد وصول', noAccessHint: 'عيّن دورًا لمنح الوصول إلى {app}.', custom: 'مخصص',
    revokeAccess: 'إلغاء الوصول', confirmRevoke: 'إزالة وصول {name} إلى {app}؟ يحتفظ بالوصول إلى التطبيقات الأخرى.', revoked: 'تمت إزالة الوصول إلى {app}.', accessGranted: 'تم حفظ الدور — تم منح الوصول إلى {app}.',
    rolePermissions: 'صلاحيات الأدوار', rolePermSubtitle: 'يتم حفظ الصلاحيات بشكل مستقل لـ {app}.',
    roleLegend: 'مسؤول: تحكم كامل · مدير: وصول تشغيلي كامل دون إدارة المستخدمين · قراءة فقط: عرض فقط · صلاحيات الوحدات: صلاحيات مخصصة لكل وحدة.',
    colRole2: 'الدور', colPermissions: 'الصلاحيات', colAction: 'إجراء',
    fullAccess: 'وصول كامل', edit: 'تعديل',
    addUserTitle: 'إضافة مستخدم', editUserTitle: 'تعديل المستخدم', name: 'الاسم', email: 'البريد الإلكتروني', role: 'الدور', adminApproved: 'موافقة المسؤول',
    appAccess: 'الوصول إلى التطبيقات', cancel: 'إلغاء', save: 'حفظ', saving: 'جارٍ الحفظ…', close: 'إغلاق',
    createError: 'تعذر إنشاء المستخدم.', existingIdentityGranted: 'تم منح الهوية الحالية صلاحية الوصول إلى التطبيق.',
    userCreatedTempPassword: 'تم إنشاء المستخدم. كلمة المرور المؤقتة: {pwd}', tempPasswordHint: 'شاركها بأمان — تُعرض مرة واحدة ويجب تغييرها عند أول تسجيل دخول.',
    moduleAccessTitle: '{name} · صلاحيات الوحدات', moduleAccessSaveError: 'تعذر حفظ صلاحيات الوحدات.',
    moduleAccessSaved: 'تم حفظ صلاحيات الوحدات.', nameSaved: 'تم تحديث المستخدم.',
    roleAdmin: 'مسؤول', roleManager: 'مدير', roleSales: 'مبيعات', roleEstimator: 'مقدّر تكاليف',
    roleAccountant: 'محاسب', roleProduction: 'إنتاج', roleReadonly: 'قراءة فقط',
    levelViewOnly: 'عرض فقط', levelViewEdit: 'عرض وتعديل', levelFullAccess: 'وصول كامل',
    roleFor: 'دور {name}', approvedFor: 'موافقة المسؤول: {name}',
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

const BTN = 'rounded-xl border border-[color:var(--bd)] px-4 py-2 text-sm hover:bg-cyan-500/10 disabled:opacity-50';
const BTN_PRIMARY = 'rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50';
const LINK = 'text-cyan-600 hover:underline disabled:opacity-50';
const INPUT = 'mt-1 w-full rounded-xl border border-[color:var(--bd)] bg-transparent px-3 py-2';
const SELECT = 'rounded-lg border border-[color:var(--bd)] bg-[color:var(--bg-card)] px-2 py-1';

function Modal({ title, children, onClose, tr }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-semibold">{title}</h3><button type="button" onClick={onClose} aria-label={tr('close')} className="text-xl leading-none text-[color:var(--tx-3)] hover:text-[color:var(--tx)]">×</button></div>
      {children}
    </div>
  </div>;
}

async function readJson(res) { return res.json().catch(() => ({})); }

export default function UsersWorkspace({ appId, t, lang = 'en' }) {
  const tr = useMemo(() => makeTr(lang, t), [lang, t]);
  const appLabel = APP_LABELS[appId] || appId;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [accessUser, setAccessUser] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const res = await fetch('/api/admin/users', { credentials: 'same-origin' });
      const body = await readJson(res);
      if (!res.ok) { setError(body.error || tr('loadError')); setData(d => d || { rows: [], roles: [], apps: [], modules: [] }); return; }
      setData(body);
    } catch (_) { setError(tr('networkError')); setData(d => d || { rows: [], roles: [], apps: [], modules: [] }); }
  }
  useEffect(() => { load(); }, [appId]);

  async function patchUser(body) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/users', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
      const result = await readJson(res);
      if (!res.ok) throw new Error(result.error || tr('saveError'));
      await load();
    } finally { setBusy(false); }
  }

  async function setActive(user, is_active) {
    if (!is_active && !confirm(tr('confirmDeactivate', { name: user.full_name || user.email }))) return;
    try { await patchUser({ user_id: user.id, is_active }); setMessage(tr(is_active ? 'activated' : 'deactivated')); }
    catch (e) { setError(e.message); }
  }

  async function revokeAccess(user) {
    if (!confirm(tr('confirmRevoke', { name: user.full_name || user.email, app: appLabel }))) return;
    try { await patchUser({ user_id: user.id, app_id: appId, revoke_app: true }); setMessage(tr('revoked', { app: appLabel })); }
    catch (e) { setError(e.message); }
  }

  async function assignRole(user, role) {
    try { await patchUser({ user_id: user.id, app_id: appId, role }); if (user.has_app_access === false) setMessage(tr('accessGranted', { app: appLabel })); }
    catch (e) { setError(e.message); }
  }

  async function removeUser(user) {
    if (!confirm(tr('confirmDelete', { name: user.full_name || user.email }))) return;
    setError('');
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE', credentials: 'same-origin' });
      const body = await readJson(res);
      if (!res.ok) { setError(body.error || tr('deleteError')); return; }
      setMessage(tr('deleted')); load();
    } catch (_) { setError(tr('networkError')); }
  }

  const roleLabel = role => tr(ROLE_KEYS[role] || role);
  const rows = data?.rows || [];

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">{tr('title')}</h2><p className="text-sm text-[color:var(--tx-3)]">{tr('subtitle', { app: appLabel })}</p></div>
      <button type="button" onClick={() => setAdding(true)} className={BTN_PRIMARY}>{tr('addUser')}</button>
    </div>
    {message && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600">{message}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-500">{error}</div>}

    <section className="overflow-hidden rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)]">
      <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm">
        <thead className="bg-[color:var(--nav-bg)] text-start text-xs uppercase tracking-wide text-[color:var(--tx-3)]"><tr>
          {[tr('colName'), tr('colEmail'), tr('colApp', { app: appLabel }), tr('colRole'), tr('colStatus'), tr('colApproved'), tr('colSince'), tr('colActions')].map(h => <th key={h} className="px-4 py-3 text-start">{h}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-[color:var(--bd)]">
          {!data ? <tr><td colSpan="8" className="px-4 py-10 text-center text-[color:var(--tx-3)]">{tr('loading')}</td></tr>
            : rows.length === 0 ? <tr><td colSpan="8" className="px-4 py-10 text-center text-[color:var(--tx-3)]">{tr('empty')}</td></tr>
            : rows.map(user => {
              const name = user.full_name || user.email;
              const inactive = user.is_active === false;
              return <tr key={user.id} className={'hover:bg-cyan-500/5' + (inactive ? ' opacity-60' : '')}>
                <td className="px-4 py-3 font-medium">{user.full_name || '—'}{user.platform_admin && <span className="ms-2 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-600">{tr('platformAdmin')}</span>}</td>
                <td className="px-4 py-3" dir="ltr">{user.email}</td>
                <td className="px-4 py-3">
                  <span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ' + (user.has_app_access !== false ? 'bg-emerald-500/10 text-emerald-600' : 'bg-slate-500/10 text-[color:var(--tx-3)]')}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: user.has_app_access !== false ? '#059669' : '#94a3b8' }} aria-hidden="true" />{user.has_app_access !== false ? tr('hasAccess') : tr('noAccess')}
                  </span>
                  {user.has_app_access === false && <div className="mt-1 text-[11px] text-[color:var(--tx-4)]">{tr('noAccessHint', { app: appLabel })}</div>}
                </td>
                <td className="px-4 py-3"><select aria-label={tr('roleFor', { name })} disabled={user.platform_admin || busy} value={user.app_role} onChange={e => assignRole(user, e.target.value)} className={SELECT}>
                  {(data.roles || []).map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}
                </select>{Object.keys(user.module_access || {}).length > 0 && <div className="mt-1 text-[11px] text-[color:var(--tx-4)]">{tr('custom')}</div>}</td>
                <td className="px-4 py-3"><span className={'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ' + (inactive ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-600')}><span className="h-1.5 w-1.5 rounded-full" style={{ background: inactive ? '#dc2626' : '#059669' }} aria-hidden="true" />{inactive ? tr('statusInactive') : tr('statusActive')}</span></td>
                <td className="px-4 py-3"><input type="checkbox" aria-label={tr('approvedFor', { name })} checked={user.platform_admin || !!user.is_approved} disabled={user.platform_admin || busy} onChange={e => patchUser({ user_id: user.id, is_approved: e.target.checked }).catch(e2 => setError(e2.message))} /></td>
                <td className="px-4 py-3 whitespace-nowrap text-[color:var(--tx-3)]">{user.created_at ? new Date(user.created_at).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US') : '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap space-x-3 rtl:space-x-reverse">
                  <button type="button" onClick={() => setEditing(user)} className={LINK} disabled={busy}>{tr('editName')}</button>
                  <button type="button" onClick={() => setAccessUser(user)} className={LINK} disabled={busy}>{tr('moduleAccess')}</button>
                  {!user.platform_admin && user.has_app_access !== false && <button type="button" onClick={() => revokeAccess(user)} className="text-amber-600 hover:underline disabled:opacity-50" disabled={busy}>{tr('revokeAccess')}</button>}
                  {!user.platform_admin && <button type="button" onClick={() => setActive(user, inactive)} className={inactive ? LINK : 'text-amber-600 hover:underline disabled:opacity-50'} disabled={busy}>{inactive ? tr('activate') : tr('deactivate')}</button>}
                  {!user.platform_admin && <button type="button" onClick={() => removeUser(user)} className="text-red-500 hover:underline disabled:opacity-50" disabled={busy}>{tr('delete')}</button>}
                </td>
              </tr>;
            })}
        </tbody>
      </table></div>
    </section>

    <section className="rounded-2xl border border-[color:var(--bd)] bg-[color:var(--bg-card)] p-4">
      <h3 className="mb-1 font-semibold">{tr('rolePermissions')}</h3>
      <p className="mb-1 text-sm text-[color:var(--tx-3)]">{tr('rolePermSubtitle', { app: appLabel })}</p>
      <p className="mb-4 text-xs text-[color:var(--tx-4)]">{tr('roleLegend')}</p>
      <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead className="text-start text-xs uppercase text-[color:var(--tx-3)]"><tr><th className="px-3 py-2 text-start">{tr('colRole2')}</th><th className="px-3 py-2 text-start">{tr('colPermissions')}</th><th className="px-3 py-2 text-end">{tr('colAction')}</th></tr></thead>
        <tbody className="divide-y divide-[color:var(--bd)]">{(data?.roles || []).map(role => <tr key={role}><td className="px-3 py-3 font-medium">{roleLabel(role)}</td><td className="px-3 py-3 text-[color:var(--tx-3)]">{role === 'admin' ? tr('fullAccess') : tr('custom')}</td><td className="px-3 py-3 text-end"><a href={`/users/roles/${role}`} className="rounded-lg border border-cyan-500/30 px-3 py-1.5 text-cyan-600 hover:bg-cyan-500/10">{tr('edit')}</a></td></tr>)}</tbody>
      </table></div>
    </section>

    {adding && <AddUserModal appId={appId} roles={data?.roles || []} apps={data?.apps || []} tr={tr} roleLabel={roleLabel} onClose={() => setAdding(false)} onCreated={(result) => { setAdding(false); setMessage(result.reused_identity ? tr('existingIdentityGranted') : tr('userCreatedTempPassword', { pwd: result.temp_password }) + ' ' + tr('tempPasswordHint')); load(); }} />}
    {editing && <EditUserModal user={editing} tr={tr} onClose={() => setEditing(null)} onSave={async full_name => { await patchUser({ user_id: editing.id, full_name }); setEditing(null); setMessage(tr('nameSaved')); }} />}
    {accessUser && <AccessModal appId={appId} user={accessUser} modules={data?.modules || []} tr={tr} onClose={() => setAccessUser(null)} onSave={async module_access => { await patchUser({ user_id: accessUser.id, app_id: appId, module_access }); setAccessUser(null); setMessage(tr('moduleAccessSaved')); }} />}
  </div>;
}

function AddUserModal({ appId, roles, apps, tr, roleLabel, onClose, onCreated }) {
  const [form, setForm] = useState({ full_name: '', email: '', role: 'readonly', is_approved: false });
  const [selectedApps, setSelectedApps] = useState([appId]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const res = await fetch('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ ...form, app_access: selectedApps.map(id => ({ app_id: id, role: form.role })) }) });
      const body = await readJson(res);
      if (!res.ok) { setError(body.error || tr('createError')); return; }
      onCreated(body);
    } catch (_) { setError(tr('networkError')); }
    finally { setBusy(false); }
  }
  return <Modal title={tr('addUserTitle')} onClose={onClose} tr={tr}><form onSubmit={submit} className="space-y-4">
    {error && <div role="alert" className="text-sm text-red-500">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">{tr('name')} <span className="text-red-500">*</span><input required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} className={INPUT} /></label>
      <label className="text-sm">{tr('email')} <span className="text-red-500">*</span><input required type="email" dir="ltr" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={INPUT} /></label>
      <label className="text-sm">{tr('role')}<select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className={INPUT + ' bg-[color:var(--bg-card)]'}>{roles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
      <label className="flex items-center gap-2 self-end py-2 text-sm"><input type="checkbox" checked={form.is_approved} onChange={e => setForm({ ...form, is_approved: e.target.checked })} /> {tr('adminApproved')}</label>
    </div>
    <fieldset><legend className="mb-2 text-sm font-medium">{tr('appAccess')}</legend><div className="grid gap-2 sm:grid-cols-3">{apps.map(id => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedApps.includes(id)} onChange={() => setSelectedApps(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id])} />{APP_LABELS[id] || id}</label>)}</div></fieldset>
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={BTN}>{tr('cancel')}</button><button disabled={busy || !selectedApps.length} className={BTN_PRIMARY}>{busy ? tr('saving') : tr('save')}</button></div>
  </form></Modal>;
}

function EditUserModal({ user, tr, onClose, onSave }) {
  const [name, setName] = useState(user.full_name || '');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await onSave(name.trim()); } catch (e2) { setError(e2.message || tr('saveError')); } finally { setBusy(false); }
  }
  return <Modal title={tr('editUserTitle')} onClose={onClose} tr={tr}><form onSubmit={submit} className="space-y-4">
    {error && <div role="alert" className="text-sm text-red-500">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">{tr('name')} <span className="text-red-500">*</span><input required autoFocus value={name} onChange={e => setName(e.target.value)} className={INPUT} /></label>
      <label className="text-sm">{tr('email')}<input value={user.email} readOnly dir="ltr" className={INPUT + ' opacity-70'} /></label>
    </div>
    <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className={BTN}>{tr('cancel')}</button><button disabled={busy || !name.trim()} className={BTN_PRIMARY}>{busy ? tr('saving') : tr('save')}</button></div>
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
  return <Modal title={tr('moduleAccessTitle', { name: user.full_name || user.email })} onClose={onClose} tr={tr}>{error && <div role="alert" className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</div>}<div className="space-y-2">{modules.map(module => <div key={module.id} className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--bd)] px-3 py-2"><div><div className="text-sm font-medium">{module.label}</div><div className="text-xs capitalize text-[color:var(--tx-3)]">{module.category}</div></div><select aria-label={module.label} value={levels[module.id]} disabled={module.id === 'users' || busy} onChange={e => setLevels({ ...levels, [module.id]: e.target.value })} className={SELECT + ' text-sm'}>{Object.entries(LEVEL_KEYS).map(([value, key]) => <option key={value} value={value}>{tr(key)}</option>)}</select></div>)}</div>
    <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className={BTN}>{tr('cancel')}</button><button type="button" disabled={busy} onClick={save} className={BTN_PRIMARY}>{busy ? tr('saving') : tr('save')}</button></div>
  </Modal>;
}
