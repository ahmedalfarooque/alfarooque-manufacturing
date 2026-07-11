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
  contracted: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  started: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  pr_pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  pr_accepted: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  pr_on_hold: 'bg-amber-600/15 text-amber-800 dark:text-amber-300',
  pr_rejected: 'bg-[#BC6B4E]/15 text-[#BC6B4E]',
  proj_upcoming: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  proj_running: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  proj_completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  proj_on_hold: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
};

export default function StatusBadge({ status }) {
  const { t } = useLanguage();
  return (
    <span className={'inline-block text-[11px] px-2 py-0.5 rounded-full whitespace-nowrap ' + (STYLES[status] || STYLES.draft)}>
      {t('status.' + status)}
    </span>
  );
}
