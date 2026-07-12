'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Shell from '@/components/Shell';
import { useLanguage } from '@/lib/i18n';
import { Button, Input, Field } from '@/components/ui';

export default function ProfilePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/me', { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.user) { setFullName(d.user.full_name || ''); setEmail(d.user.email || ''); }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function save() {
    setMsg(null);
    if (newPassword && newPassword !== confirmPassword) {
      setMsg('⚠ ' + t('profile.passwordMismatch'));
      return;
    }
    setBusy(true);
    const res = await fetch('/api/me', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        full_name: fullName, email,
        ...(newPassword ? { current_password: currentPassword, new_password: newPassword } : {}),
      }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) {
      setMsg(t('profile.saved'));
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } else {
      const d = res ? await res.json().catch(() => ({})) : {};
      setMsg('⚠ ' + (d.error || t('common.genericError')));
    }
  }

  return (
    <Shell active="/profile">
      <div className="max-w-xl space-y-4">
        <div className="glass-card p-5 space-y-4">
          <div className="font-semibold">{t('profile.title')}</div>
          {msg && <div className="rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{msg}</div>}
          {!loaded ? (
            <div className="text-sm text-[#8C8A80]">{t('shell.loading')}</div>
          ) : (
            <>
              <Field label={t('f.name')}>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} />
              </Field>
              <Field label={t('f.email')}>
                <Input type="email" dir="ltr" value={email} onChange={e => setEmail(e.target.value)} />
              </Field>

              <div className="pt-2 border-t border-[#E5E2DD] dark:border-white/[0.08]">
                <div className="text-sm font-medium mb-3">{t('profile.changePassword')}</div>
                <div className="space-y-3">
                  <Field label={t('profile.currentPassword')}>
                    <Input type="password" dir="ltr" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} autoComplete="current-password" />
                  </Field>
                  <Field label={t('profile.newPassword')}>
                    <Input type="password" dir="ltr" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                  </Field>
                  <Field label={t('profile.confirmPassword')}>
                    <Input type="password" dir="ltr" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  </Field>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => router.push('/dashboard')}>{t('common.close')}</Button>
                <Button disabled={busy} onClick={save}>{busy ? t('common.saving') : t('common.save')}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </Shell>
  );
}
