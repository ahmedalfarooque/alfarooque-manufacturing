'use client';
import { useLanguage } from '@/lib/i18n';
import UnifiedErpLogin from '../../../shared/UnifiedErpLogin';
export default function LoginPage() {
  const language = useLanguage();
  return <UnifiedErpLogin {...language} title="QuotePro" subtitle={language.t('login.tagline')} themeKey="af-quotation-theme" userActions={{ login:'view-login', verify:'view-verify-otp', resend:'view-resend-otp' }} adminActions={{ login:'login', verify:'verify-otp', resend:'resend-otp' }} />;
}
