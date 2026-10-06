'use client';
import ForbiddenPage from '../../../shared/ForbiddenPage';
import { useLanguage } from '@/lib/i18n';

/* Admin-only page requested by a non-admin session (see middleware.js).
   Mirrored in every app. */
export default function Page() {
  const { lang } = useLanguage();
  return <ForbiddenPage lang={lang} />;
}
