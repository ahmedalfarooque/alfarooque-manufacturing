'use client';
import { useLanguage } from '@/lib/i18n';
import UsersWorkspace from '../../../../shared/UsersWorkspace';
export default function UsersPage() {
  const { t, lang } = useLanguage();
  return <UsersWorkspace appId="accounting" t={t} lang={lang} />;
}
