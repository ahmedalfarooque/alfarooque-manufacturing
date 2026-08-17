'use client';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import UsersWorkspace from '../../../../shared/UsersWorkspace';
export default function UsersPage() {
  const { t, lang } = useLanguage();
  return <Shell active="/users"><UsersWorkspace appId="inventory" t={t} lang={lang} /></Shell>;
}
