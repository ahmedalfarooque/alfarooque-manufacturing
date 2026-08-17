'use client';

import { useState, useEffect } from 'react';
import { GlassCard, GlassButton, GlassInput, GlassSelect, GlassField, toast } from '@/components/glass';

export default function SettingsPage() {
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(b => {
      setForm(b.settings || {});
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch('/api/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Save failed');
      toast('Settings saved', 'success');
      setForm(body.settings);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="text-center text-[color:var(--tx-3)] py-12">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">CRM Settings</h1>
        <p className="text-sm text-[color:var(--tx-3)] mt-1">Defaults applied across contacts, deals, and reports.</p>
      </div>

      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold text-[color:var(--tx-2)] mb-4">General</h3>
        <div className="grid grid-cols-2 gap-4">
          <GlassField label="Company Name">
            <GlassInput value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
          </GlassField>
          <GlassField label="Default Currency">
            <GlassSelect value={form.default_currency || 'SAR'} onChange={e => setForm(f => ({ ...f, default_currency: e.target.value }))}>
              <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
            </GlassSelect>
          </GlassField>
          <GlassField label="Win Probability Threshold (%)">
            <GlassInput type="number" min="0" max="100" value={form.win_probability_threshold ?? 70} onChange={e => setForm(f => ({ ...f, win_probability_threshold: Number(e.target.value) }))} />
          </GlassField>
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <GlassButton onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</GlassButton>
      </div>
    </div>
  );
}
