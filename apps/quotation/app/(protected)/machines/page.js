'use client';

import MasterList from '@/components/MasterList';

const columns = [
  { key: 'code', labelKey: 'f.code' },
  { key: 'name', labelKey: 'f.name' },
  { key: 'category', labelKey: 'f.category' },
  { key: 'hourly_cost', labelKey: 'f.hourlyCost' },
  { key: 'setup_cost', labelKey: 'f.setupCost' },
];

const fields = [
  { key: 'code', labelKey: 'f.code' },
  { key: 'name_en', labelKey: 'f.nameEn' },
  { key: 'name_ar', labelKey: 'f.nameAr', dir: 'rtl' },
  { key: 'category', labelKey: 'f.category' },
  { key: 'hourly_cost', labelKey: 'f.hourlyCost', type: 'number' },
  { key: 'setup_cost', labelKey: 'f.setupCost', type: 'number' },
  { key: 'notes', labelKey: 'f.notes', type: 'textarea' },
];

export default function MachinesPage() {
  return <MasterList active="/machines" api="/api/machines" titleKey="nav.machines" columns={columns} fields={fields} />;
}
