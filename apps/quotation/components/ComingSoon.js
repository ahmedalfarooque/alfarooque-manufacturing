'use client';

import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';

/* Placeholder used by every module route that ships in a later phase,
   so the full navigation works from Phase 0 without dead links. */
export default function ComingSoon({ active }) {
  const { t } = useLanguage();
  return (
    <Shell active={active}>
      <div className="glass-card p-10 text-center">
        <div className="text-4xl mb-3">🛠️</div>
        <div className="text-sm text-[#8C8A80]">{t('common.comingSoon')}</div>
        <a href="/dashboard" className="inline-block mt-4 text-sm text-brand-600 dark:text-brand-400 hover:underline">
          {t('common.backToDashboard')}
        </a>
      </div>
    </Shell>
  );
}
