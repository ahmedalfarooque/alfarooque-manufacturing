'use client';
import AppLauncher from '../../../shared/AppLauncher';
import { APPS, getAppUrl } from '@/lib/appLinks';
import { useLanguage } from '@/lib/i18n';

/* A signed-in user whose account was not granted this application lands
   here (middleware) instead of on a dashboard they may not use. Lists the
   applications they do have, or the "nothing assigned" state. */
export default function NoAccessPage() {
  const { lang } = useLanguage();
  return <AppLauncher selfId="accounting" apps={APPS} getAppUrl={getAppUrl} lang={lang} notice="app_not_granted" autoOpenSingle={false} />;
}
