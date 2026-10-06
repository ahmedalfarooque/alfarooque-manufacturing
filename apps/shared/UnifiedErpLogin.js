'use client';

import { useEffect, useRef, useState } from 'react';
import { APP_LABELS } from './appAccess';

const Icon = ({ name }) => {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'globe') return <svg {...common}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>;
  if (name === 'sun') return <svg {...common}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></svg>;
  if (name === 'moon') return <svg {...common}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>;
  if (name === 'mail') return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
  if (name === 'lock') return <svg {...common}><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>;
  return <svg {...common}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>;
};

async function request(action, payload, fallbackError) {
  const response = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ action, ...payload }),
  });
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    const error = new Error(data.error || fallbackError || 'Something went wrong.');
    error.retryAfter = data.retryAfter;
    error.code = data.code; error.apps = Array.isArray(data.apps) ? data.apps : null;
    throw error;
  }
  return data;
}

export default function UnifiedErpLogin({
  t, lang, setLang, title, subtitle, themeKey,
  userActions, adminActions, userRedirect = '/dashboard', adminRedirect = '/dashboard', getAppUrl = null,
}) {
  const [mode, setMode] = useState('user');
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [dark, setDark] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const requestedMode = new URLSearchParams(window.location.search).get('mode');
    if (requestedMode === 'admin') setMode('admin');
    /* Every app's own design system is light-by-default (see globals.css:
       ":root" holds the light tokens, "html.dark" opts in) — this must
       match, or a first-time visitor sees a dark login screen and then a
       light dashboard after logging in. Verified live in a real browser
       this session: the previous 'dark' default here disagreed with
       every app's own Shell.js init (which already used `saved==='dark'`,
       i.e. light unless explicitly saved as dark). */
    let saved = null;
    try { saved = localStorage.getItem(themeKey); } catch (_) {}
    const isDark = saved === 'dark';
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
    return () => clearInterval(timer.current);
  }, [themeKey]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  function startCooldown(seconds) {
    clearInterval(timer.current);
    setCooldown(seconds);
    timer.current = setInterval(() => setCooldown(value => {
      if (value <= 1) { clearInterval(timer.current); return 0; }
      return value - 1;
    }), 1000);
  }

  function selectMode(next) {
    setMode(next); setStep('credentials'); setPassword(''); setCode('');
    setShowPassword(false); setMessage(null); setCooldown(0); clearInterval(timer.current);
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem(themeKey, next ? 'dark' : 'light'); } catch (_) {}
  }

  const actions = mode === 'admin' ? adminActions : userActions;

  async function submitCredentials(event) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const data = await request(actions.login, { email, ...(mode === 'admin' ? { password } : {}) }, t('login.genericError'));
      setMessage({ type: 'success', text: data.message }); setStep('otp'); startCooldown(60);
    } catch (error) { setMessage({ type: 'error', text: error.message }); }
    finally { setBusy(false); }
  }

  async function submitOtp(event) {
    event.preventDefault(); setBusy(true); setMessage(null);
    try {
      const data = await request(actions.verify, { email, code }, t('login.genericError'));
      setMessage({ type: 'success', text: t('login.successRedirect') });
      /* The server decides where a signed-in user goes: the application
         launcher when they may enter several apps, otherwise this app. */
      const explicit = new URLSearchParams(window.location.search).get('redirect');
      const target = (!explicit && data && data.next === '/launch') ? '/launch' : (mode === 'admin' ? adminRedirect : userRedirect);
      setTimeout(() => { window.location.href = target; }, 400);
    } catch (error) {
      /* Application access denied: say which applications the account
         does have (links when this app knows the sibling URLs). */
      const apps = error.apps && error.apps.length ? error.apps : null;
      setMessage({ type: 'error', text: error.message, apps });
      setBusy(false);
    }
  }

  async function resend() {
    setMessage(null);
    try {
      const data = await request(actions.resend, { email }, t('login.genericError'));
      setMessage({ type: 'success', text: data.message }); startCooldown(60);
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
      if (error.retryAfter) startCooldown(error.retryAfter);
    }
  }

  return <main className="erp-login">
    <div className="erp-orb erp-orb-a" /><div className="erp-orb erp-orb-b" />
    <i className="erp-star s1" /><i className="erp-star s2" /><i className="erp-star s3" /><i className="erp-star s4" />
    <section className="erp-card" aria-label={`${title} login`}>
      <div className="erp-controls">
        <div className="erp-controls-left">
          <button type="button" className="erp-control" aria-label={t('shell.toggleLanguage')} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}><Icon name="globe" /></button>
          <button type="button" className="erp-control" aria-label={t('shell.toggleLanguage')} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'ع'}</button>
        </div>
        <button type="button" className="erp-control" aria-label={t('shell.toggleTheme')} aria-pressed={dark} onClick={toggleTheme}><Icon name={dark ? 'sun' : 'moon'} /></button>
      </div>

      <div className="erp-brand">
        <div className="erp-logo"><img src="/logo.png" alt="AL FAROOQUE" /></div>
        <h1>{title}</h1><p>{subtitle}</p>
      </div>

      {step === 'credentials' && <div className="erp-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'user'} className={mode === 'user' ? 'active' : ''} onClick={() => selectMode('user')}>{lang === 'ar' ? 'مستخدم' : 'User'}</button>
        <button type="button" role="tab" aria-selected={mode === 'admin'} className={mode === 'admin' ? 'active' : ''} onClick={() => selectMode('admin')}>{lang === 'ar' ? 'مسؤول' : 'Admin'}</button>
      </div>}

      {message && <div className={`erp-message ${message.type}`}>{message.text}
        {message.apps && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {message.apps.map(id => getAppUrl
            ? <a key={id} href={getAppUrl(id)} style={{ textDecoration: 'underline', fontWeight: 600 }}>{APP_LABELS[id] || id}</a>
            : <span key={id} style={{ fontWeight: 600 }}>{APP_LABELS[id] || id}</span>)}
        </div>}
      </div>}

      {step === 'credentials' ? <form onSubmit={submitCredentials} className="erp-form">
        <label>{t('login.email')}<span className="erp-input"><b><Icon name="mail" /></b><input type="email" required value={email} onChange={e => setEmail(e.target.value)} /></span></label>
        {mode === 'admin' && <label>{t('login.password')}<span className="erp-input"><b><Icon name="lock" /></b><input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} /><button type="button" aria-label="Show password" onClick={() => setShowPassword(value => !value)}><Icon name="eye" /></button></span></label>}
        <button className="erp-primary" disabled={busy}>{busy ? t('login.signingIn') : t('login.continue')}</button>
      </form> : <form onSubmit={submitOtp} className="erp-form">
        <p className="erp-code-note">{t('login.codeSentTo') || t('login.otpSentPrefix')} <strong>{email}</strong></p>
        <label>{t('login.otp') || 'Verification code'}<span className="erp-input"><input className="erp-code" inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} /></span></label>
        <button className="erp-primary" disabled={busy}>{busy ? t('login.verifying') : t('login.verifyAndSignIn')}</button>
        <button type="button" className="erp-secondary" disabled={cooldown > 0} onClick={resend}>{cooldown > 0 ? `${t('login.resendCode') || 'Resend code'} (${cooldown})` : t('login.resendCode')}</button>
        <button type="button" className="erp-back" onClick={() => selectMode(mode)}>{mode === 'admin' ? t('login.backToEmailPassword') : t('login.backToEmail')}</button>
      </form>}

      <footer>© 2026 AL FAROOQUE. All rights reserved.</footer>
    </section>
    <style jsx>{`
      .erp-login{--ink:#f5fbff;--muted:#899da7;--line:rgba(157,203,218,.25);min-height:100vh;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:26px;background:linear-gradient(115deg,#041118 0%,#061a23 48%,#07313d 100%);color:var(--ink);font-family:inherit}
      .erp-login:before{content:'';position:absolute;inset:0;background:radial-gradient(circle at 12% 4%,rgba(37,185,207,.47),transparent 32%),radial-gradient(circle at 88% 85%,rgba(7,116,137,.25),transparent 36%)}
      .erp-orb{position:absolute;border-radius:50%;filter:blur(55px);opacity:.24}.erp-orb-a{width:420px;height:420px;background:#18c5dc;left:-180px;top:-180px}.erp-orb-b{width:360px;height:360px;background:#07859d;right:-130px;bottom:-160px}
      .erp-star{position:absolute;width:3px;height:3px;border-radius:50%;background:#8de9f6;opacity:.35}.s1{left:12%;top:22%}.s2{right:18%;top:19%}.s3{left:22%;bottom:21%}.s4{right:8%;bottom:27%}
      .erp-card{position:relative;z-index:1;box-sizing:border-box;width:min(512px,100%);min-height:630px;padding:46px 48px 37px;border:1.5px solid rgba(177,210,220,.27);border-radius:31px;background:linear-gradient(145deg,rgba(25,62,76,.68),rgba(6,31,42,.76));box-shadow:0 22px 64px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.06);backdrop-filter:blur(17px);display:flex;flex-direction:column}
      .erp-controls{display:flex;justify-content:space-between;align-items:center}.erp-controls-left{display:flex;gap:8px}.erp-control{width:43px;height:32px;border-radius:18px;border:1px solid rgba(173,210,222,.18);background:rgba(130,173,188,.17);color:#b9cad0;font-weight:700;cursor:pointer;box-shadow:0 7px 20px rgba(0,0,0,.13);display:grid;place-items:center}.erp-control svg{width:13px;height:13px}
      .erp-brand{text-align:center;margin:27px 0 0}.erp-logo{width:65px;height:65px;margin:auto;border:1px solid rgba(180,215,225,.25);border-radius:20px;background:rgba(139,178,192,.12);display:grid;place-items:center}.erp-logo img{width:46px;height:46px;object-fit:contain}.erp-brand h1{font-size:25px;line-height:1.1;margin:18px 0 8px;font-weight:800;letter-spacing:-.9px}.erp-brand p{margin:0;color:var(--muted);font-size:12px}
      .erp-tabs{margin-top:0;border:1px solid rgba(151,198,213,.2);border-radius:14px;padding:4px;display:grid;grid-template-columns:1fr 1fr;background:rgba(83,124,140,.09)}.erp-tabs button{height:41px;border:0;border-radius:11px;background:transparent;color:#82939b;font-size:14px;font-weight:700;cursor:pointer}.erp-tabs button.active{color:white;background:linear-gradient(100deg,#58cce3,#098da8);box-shadow:0 9px 20px rgba(10,175,204,.28)}
      .erp-form{display:grid;gap:18px;margin-top:30px}.erp-form label{display:grid;gap:8px;color:#91a5af;font-size:12px;font-weight:600}.erp-input{box-sizing:border-box;height:48px;display:flex;align-items:center;gap:10px;border:1px solid rgba(154,199,215,.2);border-radius:14px;background:rgba(80,115,143,.36);padding:0 14px}.erp-input b{color:#19aecd;font-weight:400;display:grid;place-items:center}.erp-input b svg{width:15px;height:15px}.erp-input input{width:100%;height:100%;border:0;outline:0;background:transparent;color:#fff;font:inherit;font-size:13px}.erp-input button{border:0;background:rgba(120,160,180,.12);color:#78909c;border-radius:10px;width:32px;height:32px;cursor:pointer;display:grid;place-items:center}.erp-primary,.erp-secondary{height:47px;border:0;border-radius:14px;font:inherit;font-size:14px;font-weight:800;cursor:pointer}.erp-primary{color:#fff;background:linear-gradient(100deg,#59cfe6,#078ba6);box-shadow:0 10px 22px rgba(17,181,210,.27)}.erp-secondary{color:#dce9ed;background:rgba(111,151,168,.18);border:1px solid var(--line)}button:disabled{opacity:.58;cursor:not-allowed}.erp-back{border:0;background:none;color:#93a6ae;cursor:pointer}.erp-message{margin:14px 0 -14px;padding:9px 11px;border-radius:10px;font-size:12px}.erp-message.success{background:rgba(16,185,129,.12);color:#a7f3d0}.erp-message.error{background:rgba(239,68,68,.12);color:#fecaca}.erp-code-note{color:#91a5af;margin:0}.erp-code-note strong{color:white}.erp-code{text-align:center;letter-spacing:.5em}.erp-card footer{text-align:center;color:#81949d;font-size:11px;margin-top:auto;padding-top:30px}
      :global(html:not(.dark)) .erp-login{--ink:#18313a;--muted:#607b85;background:linear-gradient(120deg,#dff8fb,#f4fbfc 50%,#d8f2f5)}:global(html:not(.dark)) .erp-card{background:rgba(255,255,255,.72);border-color:rgba(32,110,128,.2)}:global(html:not(.dark)) .erp-input{background:rgba(226,241,246,.8)}:global(html:not(.dark)) .erp-input input,:global(html:not(.dark)) .erp-code-note strong{color:#17343e}
      @media(max-width:560px){.erp-login{padding:12px;align-items:flex-start;overflow:auto}.erp-card{min-height:calc(100vh - 24px);padding:28px 22px 26px;border-radius:25px}.erp-brand{margin-top:22px}.erp-form{margin-top:25px}.erp-card footer{padding-top:24px}}
    `}</style>
  </main>;
}
