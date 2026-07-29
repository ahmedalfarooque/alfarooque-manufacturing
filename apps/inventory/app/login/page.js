'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';

const API = '/api/auth';

async function call(action, extra, fallbackError) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...extra }),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error(data.error || fallbackError || 'Something went wrong.');
    err.retryAfter = data.retryAfter;
    throw err;
  }
  return data;
}

export default function LoginPage() {
  const { t, lang, setLang } = useLanguage();
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [dark, setDark] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => {
    try { setDark(localStorage.getItem('af-inventory-theme') === 'dark'); } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-inventory-theme', next ? 'dark' : 'light'); } catch (_) {}
  }

  function startCooldown(seconds) {
    clearInterval(timerRef.current);
    setCooldown(seconds);
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  }

  async function submitCredentials(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const data = await call('login', { email, password }, t('login.genericError'));
      setMsg({ kind: 'success', text: data.message });
      setStep('otp');
      startCooldown(60);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      await call('verify-otp', { email, code }, t('login.genericError'));
      setMsg({ kind: 'success', text: t('login.successRedirect') });
      setTimeout(() => { window.location.href = '/dashboard'; }, 400);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  async function resend() {
    setMsg(null);
    try {
      const data = await call('resend-otp', { email }, t('login.genericError'));
      setMsg({ kind: 'success', text: data.message });
      startCooldown(60);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      if (err.retryAfter) startCooldown(err.retryAfter);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card w-full max-w-md p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AL FAROOQUE" className="h-11 w-11 object-contain shrink-0" />
            <div>
              <div className="text-[color:var(--tx)] font-semibold text-lg leading-tight">AL FAROOQUE</div>
              <div className="text-[color:var(--tx-3)] text-xs">{t('login.inventoryTagline')}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="glass-ctrl" aria-label={t('shell.toggleLanguage')}>
              <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            <button type="button" onClick={toggleTheme} className="glass-ctrl" aria-label={t('shell.toggleTheme')} aria-pressed={dark}>
              <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
            </button>
          </div>
        </div>

        {msg && (
          <div className={
            'mb-4 rounded-lg px-3 py-2 text-sm whitespace-pre-line ' +
            (msg.kind === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30')
          }>{msg.text}</div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1.5">{t('login.email')}</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="ginput" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[color:var(--tx-3)] mb-1.5">{t('login.password')}</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="ginput" />
            </div>
            <button disabled={busy} type="submit" className="gbtn gbtn-primary gbtn--block">
              {busy ? t('login.signingIn') : t('login.continue')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="text-[color:var(--tx-3)] text-sm">{t('login.codeSentTo')} <span className="text-[color:var(--tx)]">{email}</span></p>
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="ginput text-center tracking-[0.5em] text-lg" />
            <button disabled={busy} type="submit" className="gbtn gbtn-primary gbtn--block">
              {busy ? t('login.verifying') : t('login.verifyAndSignIn')}
            </button>
            <button type="button" disabled={cooldown > 0} onClick={resend} className="gbtn gbtn-secondary gbtn--block">
              {cooldown > 0 ? t('login.resendCodeIn', { seconds: cooldown }) : t('login.resendCode')}
            </button>
            <button type="button" onClick={() => { setStep('credentials'); setMsg(null); setCode(''); clearInterval(timerRef.current); setCooldown(0); }}
              className="w-full text-center text-xs text-[color:var(--tx-3)] hover:text-[color:var(--tx)]">{t('login.backToEmailPassword')}</button>
          </form>
        )}
      </div>
    </div>
  );
}
