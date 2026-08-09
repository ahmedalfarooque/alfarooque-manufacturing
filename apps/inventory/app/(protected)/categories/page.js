'use client';

import { useState, useCallback } from 'react';
import Shell from '@/components/Shell';
import { GlassIcon } from '@/components/GlassIcons';
import { useLanguage } from '@/lib/i18n';
import { useLiveData } from '@/lib/useLiveData';
import { GlassModal, GlassInput, GlassSelect, GlassTextarea, GlassToast } from '@/components/glass';

const TYPE_OPTIONS = [
  { value: 'product', label: 'Product' },
  { value: 'material', label: 'Material' },
  { value: 'both', label: 'Both' },
];

export default function CategoriesPage() {
  const { t } = useLanguage();
  const [modal, setModal] = useState(null);
  const [activeTab, setActiveTab] = useState('categories');
  const [form, setForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: catData, mutate: mutateCats } = useLiveData('/api/categories', 0);
  const { data: subData, mutate: mutateSubs } = useLiveData('/api/subcategories', 0);
  const { data: unitData, mutate: mutateUnits } = useLiveData('/api/units', 0);

  const categories = catData?.categories || [];
  const subcategories = subData?.subcategories || [];
  const units = unitData?.units || [];

  const catOptions = [{ value: '', label: t('common.selectCategory') }, ...categories.map(c => ({ value: c.id, label: c.name }))];
  const typeOptions = [{ value: '', label: t('common.select') }, ...TYPE_OPTIONS];

  function open(type, item = {}) { setForm({ _type: type, ...item }); setModal(type); }
  function closeModal() { setModal(null); setForm({}); }

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const { _type, id, ...payload } = form;
      const isEdit = !!id;
      let url, method;
      if (_type === 'category') {
        url = isEdit ? '/api/categories' : '/api/categories';
        method = isEdit ? 'PUT' : 'POST';
        if (isEdit) payload.id = id;
      } else if (_type === 'subcategory') {
        url = '/api/subcategories';
        method = isEdit ? 'PUT' : 'POST';
        if (isEdit) payload.id = id;
      } else {
        url = '/api/units';
        method = isEdit ? 'PUT' : 'POST';
        if (isEdit) payload.id = id;
      }
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('common.saveFailed'));
      setToast({ kind: 'success', text: isEdit ? t('common.updated') : t('common.created') });
      closeModal();
      mutateCats(); mutateSubs(); mutateUnits();
    } catch (e) {
      setToast({ kind: 'error', text: e.message });
    } finally {
      setBusy(false);
    }
  }, [form, mutateCats, mutateSubs, mutateUnits, t]);

  const deleteItem = useCallback(async (type, id) => {
    if (!confirm(t('common.confirmDelete'))) return;
    const url = type === 'category' ? `/api/categories?id=${id}` : type === 'subcategory' ? `/api/subcategories?id=${id}` : `/api/units?id=${id}`;
    const res = await fetch(url, { method: 'DELETE', credentials: 'same-origin' });
    if (res.ok) { setToast({ kind: 'success', text: t('common.deleted') }); mutateCats(); mutateSubs(); mutateUnits(); }
    else { const d = await res.json(); setToast({ kind: 'error', text: d.error }); }
  }, [mutateCats, mutateSubs, mutateUnits, t]);

  return (
    <Shell active="/categories">
      <GlassToast toast={toast} onClose={() => setToast(null)} />
      <div className="gtabs grid grid-cols-3 max-w-xs mb-6">
        {['categories', 'subcategories', 'units'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={'gtab' + (activeTab === tab ? ' active' : '')}>
            {t(`nav.${tab === 'categories' ? 'categories' : tab === 'subcategories' ? 'categories' : 'categories'}`)}
            {tab === 'categories' ? t('cats.categoriesTab') : tab === 'subcategories' ? t('cats.subcategoriesTab') : t('cats.unitsTab')}
          </button>
        ))}
      </div>

      {activeTab === 'categories' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => open('category')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('cats.addCategory')}</button>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.type')}</th>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.description')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--bd)]">
                {categories.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                {categories.map(c => (
                  <tr key={c.id} className="hover:bg-[color:var(--pr-soft)]">
                    <td className="px-4 py-3 font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)] capitalize">{c.type || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{c.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => open('category', c)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                        <button onClick={() => deleteItem('category', c.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'subcategories' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => open('subcategory')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('cats.addSubcategory')}</button>
          </div>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-[color:var(--bd)] bg-[color:var(--bg-card)]">
                <tr>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.name')}</th>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.category')}</th>
                  <th className="text-start px-4 py-3 font-medium text-[color:var(--tx-3)]">{t('common.description')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--bd)]">
                {subcategories.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[color:var(--tx-3)]">{t('common.noData')}</td></tr>}
                {subcategories.map(s => (
                  <tr key={s.id} className="hover:bg-[color:var(--pr-soft)]">
                    <td className="px-4 py-3 font-medium">{s.name}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{s.inv_categories?.name || '—'}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{s.description || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => open('subcategory', { ...s, category_id: s.category_id })} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                        <button onClick={() => deleteItem('subcategory', s.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'units' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => open('unit')} className="gbtn gbtn-primary"><GlassIcon name="plus" size={16} bare />{t('cats.addUnit')}</button>
          </div>
          <div className="glass-card overflow-hidden">
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
                  <tr key={u.id} className="hover:bg-[color:var(--pr-soft)]">
                    <td className="px-4 py-3 font-medium">{u.name}</td>
                    <td className="px-4 py-3 text-[color:var(--tx-3)]">{u.symbol || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => open('unit', u)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm"><GlassIcon name="edit" size={15} bare /></button>
                        <button onClick={() => deleteItem('unit', u.id)} className="gbtn gbtn-ghost gbtn--icon gbtn--sm text-red-500"><GlassIcon name="trash" size={15} bare /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {modal && (
        <GlassModal title={
          modal === 'category' ? (form.id ? t('cats.editCategory') : t('cats.addCategory')) :
          modal === 'subcategory' ? (form.id ? t('cats.editSubcategory') : t('cats.addSubcategory')) :
          (form.id ? t('cats.editUnit') : t('cats.addUnit'))
        } onClose={closeModal}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.name')} *</label>
              <GlassInput value={form.name || ''} onChange={v => setForm(f => ({ ...f, name: v }))} />
            </div>
            {modal === 'category' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.type')}</label>
                  <GlassSelect value={form.type || ''} onChange={v => setForm(f => ({ ...f, type: v }))} options={typeOptions} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.description')}</label>
                  <GlassTextarea value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} rows={2} />
                </div>
              </>
            )}
            {modal === 'subcategory' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.category')} *</label>
                  <GlassSelect value={form.category_id || ''} onChange={v => setForm(f => ({ ...f, category_id: v }))} options={catOptions} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('common.description')}</label>
                  <GlassTextarea value={form.description || ''} onChange={v => setForm(f => ({ ...f, description: v }))} rows={2} />
                </div>
              </>
            )}
            {modal === 'unit' && (
              <div>
                <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1">{t('units.symbol')}</label>
                <GlassInput value={form.symbol || ''} onChange={v => setForm(f => ({ ...f, symbol: v }))} placeholder="kg, m, pcs..." />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={closeModal} className="gbtn gbtn-ghost">{t('common.cancel')}</button>
            <button onClick={save} disabled={busy || !form.name} className="gbtn gbtn-primary">{busy ? t('common.saving') : t('common.save')}</button>
          </div>
        </GlassModal>
      )}
    </Shell>
  );
}
