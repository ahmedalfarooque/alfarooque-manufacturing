'use client';

import { useState } from 'react';
import MasterList from '@/components/MasterList';
import ImportButton from '@/components/ImportButton';
import { useLanguage } from '@/lib/i18n';

const columns = [
  { key: 'name', labelKey: 'f.name' },
  { key: 'contact_person', labelKey: 'f.contactPerson' },
  { key: 'phone', labelKey: 'f.phone' },
  { key: 'country', labelKey: 'f.country' },
  { key: 'payment_terms', labelKey: 'f.paymentTerms' },
  { key: 'rating', labelKey: 'f.rating' },
];

const fields = [
  { key: 'name_en', labelKey: 'f.nameEn' },
  { key: 'name_ar', labelKey: 'f.nameAr', dir: 'rtl' },
  { key: 'contact_person', labelKey: 'f.contactPerson' },
  { key: 'phone', labelKey: 'f.phone' },
  { key: 'email', labelKey: 'f.email' },
  { key: 'address', labelKey: 'f.address' },
  { key: 'country', labelKey: 'f.country', default: 'Saudi Arabia' },
  { key: 'currency', labelKey: 'f.currency', default: 'SAR' },
  { key: 'vat_number', labelKey: 'f.vatNumber' },
  { key: 'cr_number', labelKey: 'f.crNumber' },
  { key: 'payment_terms', labelKey: 'f.paymentTerms' },
  { key: 'bank_name', labelKey: 'f.bankName' },
  { key: 'iban', labelKey: 'f.iban' },
  { key: 'rating', labelKey: 'f.rating', type: 'number', step: '1' },
  { key: 'notes', labelKey: 'f.notes', type: 'textarea' },
];

export default function SuppliersPage() {
  const { t, lang } = useLanguage();
  const [msg, setMsg] = useState(null);

  return (
    <>
      {msg && (
        <div className="fixed top-20 inset-x-0 z-50 flex justify-center px-4">
          <div className="glass-card bg-white dark:bg-[#1B1B14] px-4 py-2 text-sm shadow-xl" onClick={() => setMsg(null)}>{msg}</div>
        </div>
      )}
      <MasterList active="/suppliers" api="/api/suppliers" titleKey="nav.suppliers"
        columns={columns} fields={fields} wide
        toolbar={({ reload }) => (
          <span className="flex items-center gap-3">
            <a href={'/api/export/suppliers?template=1&lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.template')}</a>
            <a href={'/api/export/suppliers?lang=' + lang} className="text-sm text-brand-600 dark:text-brand-400 hover:underline">⇩ {t('common.export')}</a>
            <ImportButton endpoint="/api/import/suppliers" onDone={(err, d) => {
              setMsg(err ? '⚠ ' + err : t('import.genericResult', { created: d.inserted, updated: d.updated, failed: d.failed }));
              if (!err) reload();
            }} />
          </span>
        )} />
    </>
  );
}
