import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { COOKIE_NAME, verifySession } from '@/lib/auth';

export default function ProjectsRoot() {
  const token = cookies().get(COOKIE_NAME)?.value;
  const session = token ? verifySession(token) : null;
  redirect(session ? '/dashboard' : '/login');
}
