'use client';

import { useState, useRef, useEffect } from 'react';

const API = '/cars/api/auth';

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
  const [step, setStep] = useState('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const timerRef = useRef(null);

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

  async function submitPassword(e) {
    e.preventDefault();
    setMsg(null); setBusy(true);
    try {
      const data = await call('login', { email, password });
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
      await call('verify-otp', { email, code });
      setMsg({ kind: 'success', text: 'Success — redirecting…' });
      setTimeout(() => { window.location.href = '/cars/dashboard'; }, 400);
    } catch (err) {
      setMsg({ kind: 'error', text: err.message });
      setBusy(false);
    }
  }

  async function resend() {
    setMsg(null);
    try {
      const data = await call('resend-otp', { email });
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
          <div className="h-11 w-11 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-lg">TF</div>
          <div>
            <div className="text-white font-semibold text-lg leading-tight">TrackFleet</div>
            <div className="text-slate-400 text-xs">AL FAROOQUE Cars Tracking</div>
          </div>
        </div>

        {msg && (
          <div className={
            'mb-4 rounded-lg px-3 py-2 text-sm ' +
            (msg.kind === 'success' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/10 text-red-300 border border-red-500/30')
          }>{msg.text}</div>
        )}

        {step === 'password' ? (
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Password</label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" />
            </div>
            <button disabled={busy} type="submit"
              className="w-full rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-60 text-white font-medium text-sm py-2.5 transition">
              {busy ? 'Signing in…' : 'Continue'}
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
            <button type="button" onClick={() => { setStep('password'); setMsg(null); }}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300">← Back to email &amp; password</button>
          </form>
        )}
      </div>
    </div>
  );
}
