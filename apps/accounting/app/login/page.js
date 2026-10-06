'use client';
import { useLanguage } from '@/lib/i18n';
import UnifiedErpLogin from '../../../shared/UnifiedErpLogin';
import { getAppUrl } from '@/lib/appLinks';
export default function LoginPage() {
  const language = useLanguage();
  return <UnifiedErpLogin {...language} title="Accounting" subtitle={language.t('login.accountingTagline')} themeKey="af-accounting-theme" userActions={{ login:'email-login', verify:'verify-otp', resend:'resend-otp' }} adminActions={{ login:'login', verify:'verify-otp', resend:'resend-otp' }} getAppUrl={getAppUrl} />;
}
