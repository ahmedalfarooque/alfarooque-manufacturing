'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard, GlassButton, GlassInput, GlassField, toast, GlassToastHost } from '@/components/glass';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submitCredentials(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', email, password }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'Login failed'); return; }
      setStep('otp');
    } catch (_) { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function submitOtp(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-otp', email, otp }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.error || 'Invalid OTP'); return; }
      router.push('/dashboard');
    } catch (_) { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function resendOtp() {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resend-otp', email }),
    });
    const body = await res.json();
    if (res.ok) toast('OTP resent to your email', 'success');
    else setError(body.error || 'Could not resend OTP');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0f1e] p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">AL FAROOQUE</h1>
          <p className="text-cyan-400 text-sm mt-1">CRM — Customer Relationship Management</p>
        </div>

        <GlassCard>
          {step === 'credentials' ? (
            <form onSubmit={submitCredentials} className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-2">Sign In</h2>
              {error && <p className="text-rose-400 text-sm bg-rose-500/10 rounded-lg p-2">{error}</p>}
              <GlassField label="Email">
                <GlassInput type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </GlassField>
              <GlassField label="Password">
                <GlassInput type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
              </GlassField>
              <GlassButton type="submit" disabled={loading} className="w-full">
                {loading ? 'Signing in…' : 'Continue'}
              </GlassButton>
            </form>
          ) : (
            <form onSubmit={submitOtp} className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-2">Enter OTP</h2>
              <p className="text-slate-400 text-sm">A one-time code was sent to <span className="text-cyan-400">{email}</span></p>
              {error && <p className="text-rose-400 text-sm bg-rose-500/10 rounded-lg p-2">{error}</p>}
              <GlassField label="6-Digit Code">
                <GlassInput type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} required autoFocus />
              </GlassField>
              <GlassButton type="submit" disabled={loading} className="w-full">
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </GlassButton>
              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => setStep('credentials')} className="text-slate-400 hover:text-white">← Back</button>
                <button type="button" onClick={resendOtp} className="text-cyan-400 hover:text-cyan-300">Resend OTP</button>
              </div>
            </form>
          )}
        </GlassCard>
      </div>
      <GlassToastHost />
    </div>
  );
}
