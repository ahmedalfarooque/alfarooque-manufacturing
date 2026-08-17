'use client';
import { useLanguage } from '@/lib/i18n';
import RolePermissionsEditor from '../../../../../../shared/RolePermissionsEditor';
export default function RolePermissionsPage({ params }) {
  const { t, lang } = useLanguage();
  return <RolePermissionsEditor appId="accounting" role={params.role} t={t} lang={lang} />;
}
