'use client';
import { useLang } from '@/lib/i18n';
import UsersWorkspace from '../../../../shared/UsersWorkspace';
export default function UsersPage() {
  const { t, lang } = useLang();
  return <UsersWorkspace appId="crm" t={t} lang={lang} />;
}
