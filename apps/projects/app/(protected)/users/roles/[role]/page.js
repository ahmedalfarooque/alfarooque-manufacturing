'use client';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import RolePermissionsEditor from '../../../../../../shared/RolePermissionsEditor';
export default function RolePermissionsPage({ params }) {
  const { t, lang } = useLanguage();
  return <Shell active="/users"><RolePermissionsEditor appId="projects" role={params.role} t={t} lang={lang} /></Shell>;
}
