'use client';
import { useLang } from '@/lib/i18n';
import RolePermissionsEditor from '../../../../../../shared/RolePermissionsEditor';
export default function RolePermissionsPage({ params }) {
  const { t, lang } = useLang();
  return <RolePermissionsEditor appId="crm" role={params.role} t={t} lang={lang} />;
}
