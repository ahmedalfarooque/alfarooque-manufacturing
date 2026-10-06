'use client';
import AppLauncher from '../../../shared/AppLauncher';
import { APPS, getAppUrl } from '@/lib/appLinks';
import { useLanguage } from '@/lib/i18n';

/* Shown after sign-in when the user may enter more than one application.
   Mirrored in every app (only selfId differs). */
export default function LaunchPage() {
  const { lang } = useLanguage();
  return <AppLauncher selfId="accounting" apps={APPS} getAppUrl={getAppUrl} lang={lang} />;
}
