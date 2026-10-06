'use client';
import { useLanguage } from '@/lib/i18n';
import UnifiedErpLogin from '../../../shared/UnifiedErpLogin';
import { getAppUrl } from '@/lib/appLinks';
export default function LoginPage() {
  const language = useLanguage();
  return <UnifiedErpLogin {...language} title="ProTrack" subtitle={language.t('shell.appTagline')} themeKey="af-projects-theme" userActions={{ login:'view-login', verify:'view-verify-otp', resend:'view-resend-otp' }} adminActions={{ login:'login', verify:'verify-otp', resend:'resend-otp' }} getAppUrl={getAppUrl} />;
}
