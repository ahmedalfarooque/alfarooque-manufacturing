import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import Shell from '@/components/Shell';
import { LanguageProvider } from '@/lib/i18n';

async function getSession() {
  const cookieStore = cookies();
  const token = cookieStore.get('af_crm_session')?.value || cookieStore.get('af_sso_session')?.value;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET));
    return payload;
  } catch (_) { return null; }
}

export default async function ProtectedLayout({ children }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <LanguageProvider>
      <Shell session={session}>{children}</Shell>
    </LanguageProvider>
  );
}
