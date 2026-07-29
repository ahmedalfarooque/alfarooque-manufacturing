'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassToast } from '@/components/glass';

export default function SettingsPage() {
  const { t, lang, setLang } = useLanguage();
  const [activeTab, setActiveTab] = useState('users');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: usersData, mutate: mutateUsers } = useLiveData('/api/users', 0);
  const { data: rolesData } = useLiveData('/api/roles', 0);
  const { data: catData, mutate: mutateCats } = useLiveData('/api/categories', 0);
  const { data: unitData, mutate: mutateUnits } = useLiveData('/api/units', 0);
  const { data: brandData, mutate: mutateBrands } = useLiveData('/api/brands', 0);

  const users = usersData?.users || [];
  const roles = rolesData?.roles || [];
  const myRole = rolesData?.myRole || 'readonly';
  const categories = catData?.categories || [];
  const units = unitData?.units || [];
  const brands = brandData?.brands || [];

  const roleOptions = roles.map(r => ({ value: r, label: r }));

  const saveRole = useCallback(async (userId, role) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/users`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ user_id: userId, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.updated') });
      mutateUsers();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [mutateUsers, t]);

  const saveItem = useCallback(async (endpoint, mutateFn) => {
    setBusy(true);
    try {
      const method = form.id ? 'PUT' : 'POST';
      const url = form.id ? `${endpoint}/${form.id}` : endpoint;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: form.id ? t('common.updated') : t('common.created') });
      setModal(null); setForm({});
      mutateFn();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [form, t]);

  const deleteItem = useCallback(async (endpoint, id, mutateFn) => {
    if (!confirm(t('common.confirmDelete'))) return;
    setBusy(true);
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: 'DELETE', credentials: 'same-origin' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: t('common.deleted') });
      mutateFn();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally { setBusy(false); }
  }, [t]);

  const tabs = [
    { key: 'users', label: t('settings.userRoles') },
    { key: 'categories', label: t('nav.categories') },
    { key: 'units', label: t('nav.units') },
    { key: 'brands', label: t('nav.brands') },
    { key: 'general', label: t('settings.general') },
  ];

  return (
    <Shell active="/settings">
      <GlassToast toast={toast} onClose={() => setToast(null)} />

      <div className="flex gap-1 p-1 glass-card rounded-lg mb-6 w-fit">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-[color:var(--pr)] text-white' : 'text-[color:var(--tx-3)] hover:text-[color:var(--tx)]'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'users' && (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.email')}</th>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('settings.inventoryRole')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--bd)]">
                {users.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                    <td className="px-4 py-3 font-medium">{u.full_name || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{u.email}</td>
                    <td className="px-4 py-3 w-48">
                      {myRole === 'admin' ? (
                        <GlassSelect
                          value={u.inv_role || ''}
                          onChange={v => saveRole(u.id, v)}
                          options={[{ value: '', label: t('settings.noAccess') }, ...roleOptions]}
                        />
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[color:var(--pr-soft)] text-[color:var(--pr)]">{u.inv_role || t('settings.noAccess')}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setForm({}); setModal('category'); }} className="gbtn gbtn-primary">
              <GlassIcon name="plus" size={16} bare />{t('categories.addCategory')}
            </button>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.description')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {categories.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                  {categories.map(c => (
                    <tr key={c.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-[color:var(--tx-3)]">{c.description || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setForm(c); setModal('category'); }} className="gbtn gbtn-ghost gbtn--sm gbtn--icon"><GlassIcon name="edit" size={14} bare /></button>
                          <button onClick={() => deleteItem('/api/categories', c.id, mutateCats)} className="gbtn gbtn-ghost gbtn--sm gbtn--icon text-red-500"><GlassIcon name="trash" size={14} bare /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'units' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setForm({}); setModal('unit'); }} className="gbtn gbtn-primary">
              <GlassIcon name="plus" size={16} bare />{t('units.addUnit')}
            </button>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('units.symbol')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {units.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                  {units.map(u => (
                    <tr key={u.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                      <td className="px-4 py-3 font-medium">{u.name}</td>
                      <td className="px-4 py-3 text-[color:var(--tx-3)]">{u.symbol || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setForm(u); setModal('unit'); }} className="gbtn gbtn-ghost gbtn--sm gbtn--icon"><GlassIcon name="edit" size={14} bare /></button>
                          <button onClick={() => deleteItem('/api/units', u.id, mutateUnits)} className="gbtn gbtn-ghost gbtn--sm gbtn--icon text-red-500"><GlassIcon name="trash" size={14} bare /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'brands' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => { setForm({}); setModal('brand'); }} className="gbtn gbtn-primary">
              <GlassIcon name="plus" size={16} bare />{t('brands.addBrand')}
            </button>
          </div>
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                  <tr>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                    <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.description')}</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--bd)]">
                  {brands.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                  {brands.map(b => (
                    <tr key={b.id} className="hover:bg-[color:var(--pr-soft)] transition-colors">
                      <td className="px-4 py-3 font-medium">{b.name}</td>
                      <td className="px-4 py-3 text-[color:var(--tx-3)]">{b.description || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setForm(b); setModal('brand'); }} className="gbtn gbtn-ghost gbtn--sm gbtn--icon"><GlassIcon name="edit" size={14} bare /></button>
                          <button onClick={() => deleteItem('/api/brands', b.id, mutateBrands)} className="gbtn gbtn-ghost gbtn--sm gbtn--icon text-red-500"><GlassIcon name="trash" size={14} bare /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="max-w-md space-y-6">
          <div className="glass-card glass-card--pad">
            <div className="text-sm font-semibold mb-4">{t('settings.language')}</div>
            <GlassSelect
              value={lang}
              onChange={setLang}
              options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]}
            />
          </div>
          <div className="glass-card glass-card--pad">
            <div className="text-sm font-semibold mb-2">{t('settings.appInfo')}</div>
            <div className="space-y-1 text-sm text-[color:var(--tx-3)]">
              <div className="flex justify-between"><span>{t('settings.appName')}</span><span className="text-[color:var(--tx)]">AL FAROOQUE Inventory</span></div>
              <div className="flex justify-between"><span>{t('settings.version')}</span><span className="text-[color:var(--tx)]">1.0.0</span></div>
              <div className="flex justify-between"><span>{t('settings.yourRole')}</span><span className="text-[color:var(--pr)] font-medium">{myRole}</span></div>
            </div>
          </div>
        </div>
      )}

      {modal === 'category' && (
        <GlassModal title={form.id ? t('common.edit') : t('categories.addCategory')} onClose={() => { setModal(null); setForm({}); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.description')}</label>
              <GlassInput value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setModal(null); setForm({}); }} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={() => saveItem('/api/categories', mutateCats)} disabled={busy || !form.name} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}

      {modal === 'unit' && (
        <GlassModal title={form.id ? t('common.edit') : t('units.addUnit')} onClose={() => { setModal(null); setForm({}); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('units.symbol')}</label>
              <GlassInput value={form.symbol || ''} onChange={v => setForm(f => ({ ...f, symbol: v }))} placeholder="kg, pcs, m²" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setModal(null); setForm({}); }} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={() => saveItem('/api/units', mutateUnits)} disabled={busy || !form.name} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}

      {modal === 'brand' && (
        <GlassModal title={form.id ? t('common.edit') : t('brands.addBrand')} onClose={() => { setModal(null); setForm({}); }}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.description')}</label>
              <GlassInput value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setModal(null); setForm({}); }} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={() => saveItem('/api/brands', mutateBrands)} disabled={busy || !form.name} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
