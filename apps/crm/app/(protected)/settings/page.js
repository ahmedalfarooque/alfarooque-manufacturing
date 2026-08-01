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

  if (loading) return <div className="text-center text-slate-400 py-12">Loading…</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">CRM Settings</h1>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">General</h3>
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
