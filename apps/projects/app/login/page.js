'use client';

import { useState, useRef, useEffect } from 'react';

const API = '/projects/api/auth';

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

export default function LoginPage() {
  const [mode, setMode] = useState('admin'); // 'admin' (email+password) | 'view' (email only, no password)
  const [step, setStep] = useState('credentials'); // 'credentials' | 'otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('mode') === 'view') setMode('view');
  }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

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
      setTimeout(() => { window.location.href = mode === 'admin' ? '/projects/dashboard' : '/projects/view'; }, 400);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-11 w-11 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-lg">PT</div>
          <div>
            <div className="text-white font-semibold text-lg leading-tight">ProTrack</div>
            <div className="text-slate-400 text-xs">AL FAROOQUE Project Management</div>
          </div>
        </div>

        {step === 'credentials' && (
          <div className="grid grid-cols-2 gap-1 mb-6 rounded-lg bg-white/5 p-1">
            <button type="button" onClick={() => switchMode('admin')}
              className={'rounded-md py-2 text-sm font-medium transition ' + (mode === 'admin' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200')}>
              Admin Login
            </button>
            <button type="button" onClick={() => switchMode('view')}
              className={'rounded-md py-2 text-sm font-medium transition ' + (mode === 'view' ? 'bg-brand-500 text-white' : 'text-slate-400 hover:text-slate-200')}>
              View Only
            </button>
          </div>
        )}

        {msg && (
          <div className={
            'mb-4 rounded-lg px-3 py-2 text-sm whitespace-pre-line ' +
            (msg.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30')
          }>{msg.text}</div>
        )}

        {step === 'credentials' ? (
          <form onSubmit={submitCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input type="email" required placeholder={mode === 'view' ? 'name@alfarooque.com' : undefined} value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              {mode === 'view' && <p className="text-[11px] text-slate-500 mt-1">Only @alfarooque.com accounts can use View Only — no password needed, a one-time code will be emailed to you.</p>}
            </div>
            {mode === 'admin' && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
                <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
              </div>
            )}
            <button disabled={busy} type="submit"
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 transition">
              {busy ? (mode === 'admin' ? 'Signing in…' : 'Sending code…') : (mode === 'admin' ? 'Continue' : 'Send Code')}
            </button>
          </form>
        ) : (
          <form onSubmit={submitOtp} className="space-y-4">
            <p className="text-slate-400 text-sm">We sent a 6-digit code to <span className="text-white">{email}</span></p>
            <input inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              className="w-full text-center tracking-[0.5em] text-lg rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            <button disabled={busy} type="submit"
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 transition">
              {busy ? 'Verifying…' : 'Verify & Sign In'}
            </button>
            <button type="button" disabled={cooldown > 0} onClick={resend}
              className="w-full rounded-lg border border-white/10 text-slate-300 text-sm py-2 disabled:opacity-50">
              {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
            </button>
            <button type="button" onClick={() => switchMode(mode)}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300">← Back to email{mode === 'admin' ? ' & password' : ''}</button>
          </form>
        )}
      </div>
    </div>
  );
}
