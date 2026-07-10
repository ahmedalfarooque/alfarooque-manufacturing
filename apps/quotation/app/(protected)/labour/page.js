'use client';

import MasterList from '@/components/MasterList';

const columns = [
  { key: 'name', labelKey: 'f.name' },
  { key: 'hourly_rate', labelKey: 'f.hourlyRate' },
  { key: 'daily_rate', labelKey: 'f.dailyRate' },
  { key: 'monthly_rate', labelKey: 'f.monthlyRate' },
  { key: 'default_unit', labelKey: 'f.defaultUnit', render: (row, { t }) => t('unit.' + row.default_unit) },
];

const fields = [
  { key: 'name_en', labelKey: 'f.nameEn' },
  { key: 'name_ar', labelKey: 'f.nameAr', dir: 'rtl' },
  { key: 'hourly_rate', labelKey: 'f.hourlyRate', type: 'number' },
  { key: 'daily_rate', labelKey: 'f.dailyRate', type: 'number' },
  { key: 'monthly_rate', labelKey: 'f.monthlyRate', type: 'number' },
  { key: 'overtime_multiplier', labelKey: 'f.overtimeMultiplier', type: 'number', default: 1.5 },
  {
    key: 'default_unit', labelKey: 'f.defaultUnit', type: 'select', default: 'day',
    options: [
      { value: 'hour', labelKey: 'unit.hour' },
      { value: 'day', labelKey: 'unit.day' },
      { value: 'month', labelKey: 'unit.month' },
    ],
  },
  { key: 'notes', labelKey: 'f.notes', type: 'textarea' },
];

export default function LabourPage() {
  return <MasterList active="/labour" api="/api/labour" titleKey="nav.labour" columns={columns} fields={fields} />;
}
