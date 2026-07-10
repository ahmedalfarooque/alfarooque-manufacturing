'use client';

import MasterList from '@/components/MasterList';

const CATEGORIES = ['transport', 'fuel', 'installation', 'accommodation', 'packaging',
  'food', 'miscellaneous', 'consumables', 'equipment_rental'];
const UNITS = ['fixed', 'per_day', 'per_trip', 'per_unit', 'pct_production'];

const columns = [
  { key: 'name', labelKey: 'f.name' },
  { key: 'category', labelKey: 'f.category', render: (row, { t }) => t('expcat.' + row.category) },
  { key: 'default_amount', labelKey: 'f.defaultAmount' },
  { key: 'unit', labelKey: 'f.unit', render: (row, { t }) => t('expunit.' + row.unit) },
];

const fields = [
  { key: 'name_en', labelKey: 'f.nameEn' },
  { key: 'name_ar', labelKey: 'f.nameAr', dir: 'rtl' },
  {
    key: 'category', labelKey: 'f.category', type: 'select', default: 'miscellaneous',
    options: CATEGORIES.map(c => ({ value: c, labelKey: 'expcat.' + c })),
  },
  { key: 'default_amount', labelKey: 'f.defaultAmount', type: 'number' },
  {
    key: 'unit', labelKey: 'f.unit', type: 'select', default: 'fixed',
    options: UNITS.map(u => ({ value: u, labelKey: 'expunit.' + u })),
  },
  { key: 'notes', labelKey: 'f.notes', type: 'textarea' },
];

export default function ExpensesPage() {
  return <MasterList active="/expenses" api="/api/expenses" titleKey="nav.expenses" columns={columns} fields={fields} />;
}
