'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';

const API = '/api/auth';

async function call(action, extra) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...extra }),
  });
  let data = {};
  try { data = await res.json(); } catch (_) {}
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong.');
    err.retryAfter = data.retryAfter;
    throw err;
  }
  return data;
}

/* "User" (no password, OTP-only, view access) is always the default —
   on first load, after a refresh, after logout, after session expiry.
   Nothing about the last-selected tab is ever persisted (no
   localStorage, no cookie) — component state simply starts at 'user'
   every time this page mounts, which is exactly what "never remembered"
   requires. The one exception is an explicit ?mode=admin deep link,
   which only matters for the instant of that specific page load. */
export default function LoginPage() {
  const { t, lang, setLang } = useLanguage();
  const [mode, setMode] = useState('user'); // 'user' (email only) | 'admin' (email+password)
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [dark, setDark] = useState(false);
  const timerRef = useRef(null);

  const redirectRef = useRef(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'admin') setMode('admin');
    const redirect = params.get('redirect');
    if (redirect && redirect.startsWith('/')) redirectRef.current = redirect;
  }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => {
    try { setDark(localStorage.getItem('af-projects-theme') === 'dark'); } catch (_) {}
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-projects-theme', next ? 'dark' : 'light'); } catch (_) {}
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

  function switchMode(next) {
    setMode(next);
    setStep('credentials');
    setMsg(null);
    setPassword('');
    setCode('');
    clearInterval(timerRef.current);
    setCooldown(0);
  }

  async function submitCredentials(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const data = mode === 'admin' ? await call('login', { email, password }) : await call('view-login', { email });
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
      await call(mode === 'admin' ? 'verify-otp' : 'view-verify-otp', { email, code });
      setMsg({ kind: 'success', text: 'Success — redirecting…' });
      setTimeout(() => { window.location.href = redirectRef.current || (mode === 'admin' ? '/dashboard' : '/view'); }, 400);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  async function resend() {
    setMsg(null);
    try {
      const data = await call(mode === 'admin' ? 'resend-otp' : 'view-resend-otp', { email });
      setMsg({ kind: 'success', text: data.message });
      startCooldown(60);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      if (err.retryAfter) startCooldown(err.retryAfter);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F1] dark:bg-[#14140F] px-4 transition-colors duration-200">
      <div className="w-full max-w-md rounded-2xl border border-[#E5E2DD] dark:border-white/[0.08] bg-white dark:bg-white/[0.05] shadow-[0_2px_6px_rgba(26,26,24,0.05),0_20px_50px_rgba(26,26,24,0.10)] dark:shadow-none p-5 sm:p-8">
        <div className="flex items-center justify-between gap-2 mb-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/logo.png" alt="AL FAROOQUE" className="h-11 w-11 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="text-[#1A1A18] dark:text-white font-semibold text-lg leading-tight truncate">{t('shell.appName')}</div>
              <div className="text-[#8C8A80] dark:text-slate-400 text-xs truncate">{t('login.tagline')}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="glass-ctrl lang-toggle-btn" aria-label={t('shell.toggleLanguage')}>
              <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
            <button type="button" onClick={toggleTheme} className="glass-ctrl" aria-label={t('shell.toggleTheme')} aria-pressed={dark}>
              <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
            </button>
          </div>
        </div>

        {step === 'credentials' && (
          <div className="grid grid-cols-2 gap-1 mb-6 rounded-lg bg-[#F7F5F1] dark:bg-white/5 p-1">
            <button type="button" onClick={() => switchMode('user')}
              className={'rounded-md py-2 text-sm font-medium transition ' + (mode === 'user' ? 'bg-brand-500 text-white' : 'text-[#8C8A80] dark:text-slate-400 hover:text-[#1A1A18] dark:hover:text-slate-200')}>
              {t('login.user')}
            </button>
            <button type="button" onClick={() => switchMode('admin')}
              className={'rounded-md py-2 text-sm font-medium transition ' + (mode === 'admin' ? 'bg-brand-500 text-white' : 'text-[#8C8A80] dark:text-slate-400 hover:text-[#1A1A18] dark:hover:text-slate-200')}>
              {t('login.admin')}
            </button>
          </div>
        )}

        {msg && (
          <div className={
            'mb-4 rounded-lg px-3 py-2 text-sm whitespace-pre-line ' +
            (msg.kind === 'success' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30')
          }>{msg.text}</div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#8C8A80] dark:text-slate-400 mb-1">{t('login.email')}</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[#F7F5F1] dark:bg-white/5 border border-[#E5E2DD] dark:border-white/10 px-3 py-2.5 text-[#1A1A18] dark:text-white text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            </div>
            {mode === 'admin' && (
              <div>
                <label className="block text-xs font-medium text-[#8C8A80] dark:text-slate-400 mb-1">{t('login.password')}</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-[#F7F5F1] dark:bg-white/5 border border-[#E5E2DD] dark:border-white/10 px-3 py-2.5 text-[#1A1A18] dark:text-white text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
            )}
            <button disabled={busy} type="submit"
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 transition">
              {busy ? t('login.signingIn') : t('login.continue')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="text-[#8C8A80] dark:text-slate-400 text-sm">{t('login.otpSentPrefix')} <span className="text-[#1A1A18] dark:text-white">{email}</span></p>
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-[0.5em] text-lg rounded-lg bg-[#F7F5F1] dark:bg-white/5 border border-[#E5E2DD] dark:border-white/10 px-3 py-2.5 text-[#1A1A18] dark:text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            <button disabled={busy} type="submit"
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 transition">
              {busy ? t('login.verifying') : t('login.verifyAndSignIn')}
            </button>
            <button type="button" disabled={cooldown > 0} onClick={resend}
              className="w-full rounded-lg border border-[#E5E2DD] dark:border-white/10 text-[#4A4A45] dark:text-slate-300 text-sm py-2 disabled:opacity-50">
              {cooldown > 0 ? t('login.resendCodeCountdown', { seconds: cooldown }) : t('login.resendCode')}
            </button>
            <button type="button" onClick={() => switchMode(mode)}
              className="w-full text-center text-xs text-[#8C8A80] dark:text-slate-500 hover:text-[#4A4A45] dark:hover:text-slate-300">{mode === 'admin' ? t('login.backToEmailPassword') : t('login.backToEmail')}</button>
          </form>
        )}
      </div>
    </div>
  );
}
