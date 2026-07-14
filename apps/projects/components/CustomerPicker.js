'use client';

import { useEffect, useState, useRef } from 'react';
import { CustomerModal } from '@/app/(protected)/customers/page';
import { useLanguage } from '@/lib/i18n';
import { Field, Input } from '@/components/ui';

/* Searchable "choose existing customer, or add a new one inline"
   picker used by the Add/Edit Project form. Selecting or creating a
   customer sets customer_id (the real link) plus customer_name/
   company_name (kept in sync for display) on the parent form — no
   page refresh, no navigation away from the project modal. */
export default function CustomerPicker({ value, onChange }) {
  const { t } = useLanguage();
  const [customers, setCustomers] = useState([]);
  const [query, setQuery] = useState(value?.customer_name || '');
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    fetch('/api/customers', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { customers: [] })
      .then(d => setCustomers(d.customers || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = customers.filter(c =>
    !query || c.full_name.toLowerCase().includes(query.toLowerCase()) || (c.company_name || '').toLowerCase().includes(query.toLowerCase())
  );

  function select(c) {
    setQuery(c.full_name);
    setOpen(false);
    onChange({ customer_id: c.id, customer_name: c.full_name, company_name: c.company_name || '' });
  }

  async function handleNewCustomer(form) {
    const res = await fetch('/api/customers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    setCustomers(prev => [...prev, data.customer]);
    setAddOpen(false);
    select(data.customer);
  }

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-xs text-slate-500 mb-1">{t('cust.picker.label')}</label>
      <input
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true); onChange({ customer_id: null, customer_name: e.target.value, company_name: value?.company_name || '' }); }}
        onFocus={() => setOpen(true)}
        placeholder={t('cust.picker.placeholder')}
        required
        className="w-full rounded-lg border border-black/10 dark:border-white/10 bg-transparent px-3 py-2 text-sm"
      />
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-black/10 dark:border-white/10 bg-white dark:bg-[#0f172a] shadow-lg">
          <button type="button" onClick={() => { setAddOpen(true); setOpen(false); }}
            className="w-full text-left px-3 py-2 text-sm text-brand-500 hover:bg-brand-500/10 border-b border-black/5 dark:border-white/10">
            {t('cust.picker.addNew')}
          </button>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">{t('cust.picker.noMatch')}</div>
          ) : filtered.map(c => (
            <button type="button" key={c.id} onClick={() => select(c)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/5">
              <div className="font-medium">{c.full_name}</div>
              {c.company_name && <div className="text-xs text-slate-500">{c.company_name}</div>}
            </button>
          ))}
        </div>
      )}

      {addOpen && (
        <CustomerModal
          modal={{ mode: 'add', data: { full_name: query, company_name: '', email: '', mobile_number: '', address: '', city: '', country: '', notes: '' } }}
          isAdmin
          onClose={() => setAddOpen(false)}
          onSave={async (form) => handleNewCustomer(form)}
        />
      )}
    </div>
  );
}
