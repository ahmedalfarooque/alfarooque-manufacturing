import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify } from 'jose';
import Shell from '@/components/Shell';
import { LanguageProvider } from '@/lib/i18n';

async function getSession() {
  const cookieStore = cookies();
  const appToken = cookieStore.get('af_crm_session')?.value;
  const ssoToken = cookieStore.get('af_sso_session')?.value;
  const token = appToken || ssoToken;
  if (!token || !process.env.JWT_SECRET) return null;
  try {
    const secret = ssoToken && !appToken ? (process.env.SSO_JWT_SECRET || process.env.JWT_SECRET) : process.env.JWT_SECRET;
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    if (ssoToken && !appToken && payload.sso !== true) return null;
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
