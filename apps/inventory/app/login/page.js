'use client';
import { useLanguage } from '@/lib/i18n';
import UnifiedErpLogin from '../../../shared/UnifiedErpLogin';
import { getAppUrl } from '@/lib/appLinks';
export default function LoginPage() {
  const language = useLanguage();
  return <UnifiedErpLogin {...language} title="Inventory" subtitle={language.t('login.inventoryTagline')} themeKey="af-inventory-theme" userActions={{ login:'email-login', verify:'verify-otp', resend:'resend-otp' }} adminActions={{ login:'login', verify:'verify-otp', resend:'resend-otp' }} getAppUrl={getAppUrl} />;
}
