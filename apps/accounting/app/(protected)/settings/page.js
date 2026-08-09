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
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-white">Accounting Settings</h1>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Company Information</h3>
        <div className="grid grid-cols-2 gap-4">
          <GlassField label="Company Name (English)">
            <GlassInput value={form.company_name || ''} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
          </GlassField>
          <GlassField label="Company Name (Arabic)">
            <GlassInput value={form.company_name_ar || ''} onChange={e => setForm(f => ({ ...f, company_name_ar: e.target.value }))} dir="rtl" />
          </GlassField>
          <GlassField label="VAT Number">
            <GlassInput value={form.vat_number || ''} onChange={e => setForm(f => ({ ...f, vat_number: e.target.value }))} />
          </GlassField>
          <GlassField label="CR Number">
            <GlassInput value={form.cr_number || ''} onChange={e => setForm(f => ({ ...f, cr_number: e.target.value }))} />
          </GlassField>
          <GlassField label="Phone">
            <GlassInput value={form.phone || ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </GlassField>
          <GlassField label="Email">
            <GlassInput type="email" value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </GlassField>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Financial Settings</h3>
        <div className="grid grid-cols-2 gap-4">
          <GlassField label="Default Currency">
            <GlassSelect value={form.default_currency || 'SAR'} onChange={e => setForm(f => ({ ...f, default_currency: e.target.value }))}>
              <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
            </GlassSelect>
          </GlassField>
          <GlassField label="VAT Rate (%)">
            <GlassInput type="number" step="0.01" value={form.vat_rate ?? 15} onChange={e => setForm(f => ({ ...f, vat_rate: e.target.value }))} />
          </GlassField>
          <GlassField label="Fiscal Year Start (MM-DD)">
            <GlassInput placeholder="01-01" value={form.fiscal_year_start || ''} onChange={e => setForm(f => ({ ...f, fiscal_year_start: e.target.value }))} />
          </GlassField>
        </div>
      </GlassCard>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-4">Numbering Prefixes</h3>
        <div className="grid grid-cols-3 gap-4">
          <GlassField label="Invoice Prefix">
            <GlassInput placeholder="INV-" value={form.invoice_prefix || ''} onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))} />
          </GlassField>
          <GlassField label="Bill Prefix">
            <GlassInput placeholder="BILL-" value={form.bill_prefix || ''} onChange={e => setForm(f => ({ ...f, bill_prefix: e.target.value }))} />
          </GlassField>
          <GlassField label="Journal Prefix">
            <GlassInput placeholder="JE-" value={form.journal_prefix || ''} onChange={e => setForm(f => ({ ...f, journal_prefix: e.target.value }))} />
          </GlassField>
        </div>
      </GlassCard>

      <div className="flex justify-end">
        <GlassButton onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Settings'}</GlassButton>
      </div>
    </div>
  );
}
