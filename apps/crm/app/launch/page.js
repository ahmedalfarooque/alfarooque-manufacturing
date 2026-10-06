'use client';
import AppLauncher from '../../../shared/AppLauncher';
import { APPS, getAppUrl } from '@/lib/appLinks';
import { useLang } from '@/lib/i18n';

/* Shown after sign-in when the user may enter more than one application.
   Mirrored in every app (only selfId differs). */
export default function LaunchPage() {
  const { lang } = useLang();
  return <AppLauncher selfId="crm" apps={APPS} getAppUrl={getAppUrl} lang={lang} />;
}
