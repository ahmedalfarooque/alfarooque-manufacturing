'use client';

import { useState, useRef, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { GlassIcon } from '@/components/GlassIcons';
import './login-theme-1.css';
import './login-theme-2.css';

const API = '/api/auth';

/* Small inline glass-styled icons used only on this page (email / lock /
   eye-toggle / globe). Kept local rather than added to the shared
   /public/glass-icons.svg sprite so this redesign stays scoped to the
   login screen and never touches an asset other pages also depend on. */
function MailIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2.5" y="5" width="19" height="14" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3.5 6.5L12 13L20.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 10.5V7.5a4 4 0 018 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
function EyeIcon({ off }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10.6 5.2A10.9 10.9 0 0112 5c5 0 9 4 10.5 7-.6 1.2-1.5 2.5-2.7 3.6M6.7 6.7C4.6 8 3 9.9 1.5 12c1.5 3 5.5 7 10.5 7 1.2 0 2.3-.2 3.4-.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.9 10a3 3 0 004.1 4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 12S5.5 5 12 5s10.5 7 10.5 7-4 7-10.5 7S1.5 12 1.5 12z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
function GlobeIcon() {
  return (
    <svg className="af-login-globe" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 12h18M4.5 7.5h15M4.5 16.5h15" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  /* Dark + English are always the login page's initial defaults — this
     screen intentionally does not read the app's saved theme preference
     on mount, per the design spec. Users can still toggle for the
     session; the app's own theme/lang persistence elsewhere is untouched. */
  const [dark, setDark] = useState(true);
  const timerRef = useRef(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'admin') setMode('admin');
  }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('af-cars-theme', next ? 'dark' : 'light'); } catch (_) {}
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
    setShowPassword(false);
    setCode('');
    clearInterval(timerRef.current);
    setCooldown(0);
  }

  async function submitCredentials(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const data = mode === 'admin' ? await call('login', { email, password }, t('login.genericError')) : await call('view-login', { email }, t('login.genericError'));
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
      await call(mode === 'admin' ? 'verify-otp' : 'view-verify-otp', { email, code }, t('login.genericError'));
      setMsg({ kind: 'success', text: t('login.successRedirect') });
      setTimeout(() => { window.location.href = mode === 'admin' ? '/dashboard' : '/view'; }, 400);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  async function resend() {
    setMsg(null);
    try {
      const data = await call(mode === 'admin' ? 'resend-otp' : 'view-resend-otp', { email }, t('login.genericError'));
      setMsg({ kind: 'success', text: data.message });
      startCooldown(60);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      if (err.retryAfter) startCooldown(err.retryAfter);
    }
  }

  return (
    <div className="af-login-page">
      <div className="af-login-bg" aria-hidden="true">
        <div className="af-orb af-orb--teal" />
        <div className="af-orb af-orb--navy" />
        <div className="af-orb af-orb--gray" />
        <div className="af-sparkles" />
      </div>
      <div className="af-login-card">
        <div className="af-login-top">
          <div className="af-login-controls">
            <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="glass-ctrl" aria-label={t('shell.toggleLanguage')}>
              <GlobeIcon />
            </button>
            <button type="button" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
              className="glass-ctrl" aria-label={t('shell.toggleLanguage')}>
              <span className="ctrl-label">{lang === 'ar' ? 'EN' : 'ع'}</span>
            </button>
          </div>
          <div className="af-login-controls">
            <button type="button" onClick={toggleTheme} className="glass-ctrl" aria-label={t('shell.toggleTheme')} aria-pressed={dark}>
              <GlassIcon name={dark ? 'sun' : 'moon'} size={16} className="ctrl-icon" />
            </button>
          </div>
        </div>

        <div className="af-login-brand">
          <div className="af-login-logo-badge">
            <img src="/logo.png" alt="AL FAROOQUE" className="af-login-logo" />
          </div>
          <div className="af-login-appname">TrackFleet</div>
          <div className="af-login-tagline">{t('login.tagline')}</div>
        </div>

        {step === 'credentials' && (
          <div className="af-login-tabs">
            <button type="button" onClick={() => switchMode('user')}
              className={'af-login-tab' + (mode === 'user' ? ' af-login-tab--active' : '')}>
              {t('login.user')}
            </button>
            <button type="button" onClick={() => switchMode('admin')}
              className={'af-login-tab' + (mode === 'admin' ? ' af-login-tab--active' : '')}>
              {t('login.admin')}
            </button>
          </div>
        )}

        {msg && (
          <div className={'af-login-msg mb-4 ' + (msg.kind === 'success' ? 'af-login-msg--success' : 'af-login-msg--error')}>{msg.text}</div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="space-y-4">
            <div>
              <label className="af-login-label">{t('login.email')}</label>
              <div className="af-login-input-wrap">
                <span className="af-login-input-icon"><MailIcon /></span>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="af-login-input" />
              </div>
            </div>
            {mode === 'admin' && (
              <div>
                <label className="af-login-label">{t('login.password')}</label>
                <div className="af-login-input-wrap">
                  <span className="af-login-input-icon"><LockIcon /></span>
                  <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                    className="af-login-input" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="af-login-eye-btn"
                    aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')} aria-pressed={showPassword}>
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>
            )}
            <button disabled={busy} type="submit" className="af-login-btn-primary">
              {busy ? t('login.signingIn') : t('login.continue')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--al-text-2)' }}>{t('login.codeSentTo')} <span style={{ color: 'var(--al-text)' }}>{email}</span></p>
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="af-login-input af-login-input--otp" />
            <button disabled={busy} type="submit" className="af-login-btn-primary">
              {busy ? t('login.verifying') : t('login.verifyAndSignIn')}
            </button>
            <button type="button" disabled={cooldown > 0} onClick={resend} className="af-login-btn-secondary">
              {cooldown > 0 ? t('login.resendCodeIn', { seconds: cooldown }) : t('login.resendCode')}
            </button>
            <button type="button" onClick={() => switchMode(mode)} className="af-login-link-btn">{mode === 'admin' ? t('login.backToEmailPassword') : t('login.backToEmail')}</button>
          </form>
        )}

        <div className="af-login-footer">© {new Date().getFullYear()} AL FAROOQUE. All rights reserved.</div>
      </div>
    </div>
  );
}
