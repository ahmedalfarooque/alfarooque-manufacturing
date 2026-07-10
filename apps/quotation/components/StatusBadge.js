'use client';

import { useLanguage } from '@/lib/i18n';

const STYLES = {
  draft: 'bg-[#8C8A80]/15 text-[#6B6B63] dark:text-[#A8A497]',
  pending_approval: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  approved: 'bg-brand-600/15 text-brand-700 dark:text-brand-300',
  sent: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  accepted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  rejected: 'bg-[#BC6B4E]/15 text-[#BC6B4E]',
  expired: 'bg-[#BC6B4E]/10 text-[#BC6B4E]/80',
  superseded: 'bg-[#8C8A80]/10 text-[#8C8A80] line-through',
  cancelled: 'bg-[#8C8A80]/10 text-[#8C8A80]',
};

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  return (
    <span className={'inline-block text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ' + (STYLES[status] || STYLES.draft)}>
      {t('status.' + status)}
    </span>
  );
}
