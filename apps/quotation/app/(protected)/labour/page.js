'use client';

import MasterList from '@/components/MasterList';

const columns = [
  { key: 'name', labelKey: 'f.name' },
  { key: 'hourly_rate', labelKey: 'f.hourlyRate' },
  { key: 'daily_rate', labelKey: 'f.dailyRate' },
  { key: 'monthly_rate', labelKey: 'f.monthlyRate' },
  { key: 'default_unit', labelKey: 'f.defaultUnit', render: (row, { t }) => t('unit.' + row.default_unit) },
];

/* Monthly salary is the MASTER value (company standard: 30 days/month,
   8 hours/day). Editing it instantly auto-fills:
     daily_rate  = monthly / 30
     hourly_rate = monthly / 30 / 8
   both rounded to 2 decimals. The hourly/daily fields stay fully
   editable, so the user can still override them afterwards — the
   recalc only fires when the monthly salary itself is edited. */
function ratesFromMonthly(v) {
  const m = parseFloat(v);
  if (!isFinite(m) || m <= 0) return {};
  return {
    daily_rate: Math.round((m / 30) * 100) / 100,
    hourly_rate: Math.round((m / 30 / 8) * 100) / 100,
  };
}

const fields = [
  { key: 'name_en', labelKey: 'f.nameEn' },
  { key: 'name_ar', labelKey: 'f.nameAr', dir: 'rtl' },
  { key: 'hourly_rate', labelKey: 'f.hourlyRate', type: 'number' },
  { key: 'daily_rate', labelKey: 'f.dailyRate', type: 'number' },
  { key: 'monthly_rate', labelKey: 'f.monthlyRate', type: 'number', onChange: ratesFromMonthly },
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
