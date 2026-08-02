'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GlassCard, GlassButton, GlassInput, GlassSelect, GlassField, GlassTextarea, toast } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
const emptyLine = () => ({ account_id: '', description: '', debit: '', credit: '' });

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState([]);
  const [header, setHeader] = useState({ entry_date: new Date().toISOString().slice(0, 10), description: '', reference: '', currency: 'SAR' });
  const [lines, setLines] = useState([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/chart-of-accounts?' + new URLSearchParams({}), { credentials: 'same-origin' })
      .then(r => r.json()).then(b => setAccounts(b.accounts || [])).catch(() => {});
  }, []);

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const balanced = Math.abs(totalDebit - totalCredit) < 0.005 && totalDebit > 0;

  function updateLine(i, patch) {
    setLines(ls => ls.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }
  function addLine() { setLines(ls => [...ls, emptyLine()]); }
  function removeLine(i) { setLines(ls => ls.length > 2 ? ls.filter((_, idx) => idx !== i) : ls); }

  async function save() {
    if (!balanced) { toast('Debits must equal credits before saving', 'error'); return; }
    const validLines = lines.filter(l => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0));
    if (validLines.length < 2) { toast('At least two complete lines are required', 'error'); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/journal-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...header,
          lines: validLines.map(l => ({ account_id: l.account_id, description: l.description, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Save failed');
      toast('Journal entry created', 'success');
      router.push(`/journal-entries/${body.entry.id}`);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/journal-entries"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
        <h1 className="text-2xl font-bold text-white">New Journal Entry</h1>
      </div>

      <GlassCard>
        <div className="grid grid-cols-3 gap-4">
          <GlassField label="Entry Date">
            <GlassInput type="date" value={header.entry_date} onChange={e => setHeader(h => ({ ...h, entry_date: e.target.value }))} />
          </GlassField>
          <GlassField label="Reference">
            <GlassInput value={header.reference} onChange={e => setHeader(h => ({ ...h, reference: e.target.value }))} placeholder="e.g. INV-2024-001" />
          </GlassField>
          <GlassField label="Currency">
            <GlassSelect value={header.currency} onChange={e => setHeader(h => ({ ...h, currency: e.target.value }))}>
              <option>SAR</option><option>USD</option><option>EUR</option><option>AED</option>
            </GlassSelect>
          </GlassField>
          <div className="col-span-3">
            <GlassField label="Description">
              <GlassTextarea value={header.description} onChange={e => setHeader(h => ({ ...h, description: e.target.value }))} rows={2} />
            </GlassField>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Lines</h3>
          <GlassButton variant="secondary" size="sm" onClick={addLine}>+ Add Line</GlassButton>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 uppercase tracking-wide px-1">
            <div className="col-span-4">Account</div>
            <div className="col-span-3">Description</div>
            <div className="col-span-2 text-end">Debit</div>
            <div className="col-span-2 text-end">Credit</div>
            <div className="col-span-1"></div>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <GlassSelect value={l.account_id} onChange={e => updateLine(i, { account_id: e.target.value })}>
                  <option value="">Select account…</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.account_code} — {a.name}</option>)}
                </GlassSelect>
              </div>
              <div className="col-span-3">
                <GlassInput value={l.description} onChange={e => updateLine(i, { description: e.target.value })} />
              </div>
              <div className="col-span-2">
                <GlassInput type="number" value={l.debit} onChange={e => updateLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} placeholder="0.00" />
              </div>
              <div className="col-span-2">
                <GlassInput type="number" value={l.credit} onChange={e => updateLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} placeholder="0.00" />
              </div>
              <div className="col-span-1 text-end">
                <GlassButton variant="danger" size="sm" onClick={() => removeLine(i)} disabled={lines.length <= 2}>✕</GlassButton>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-6 mt-4 pt-4 border-t border-white/10 text-sm">
          <div>Total Debit: <span className="font-semibold text-white">SAR {fmt(totalDebit)}</span></div>
          <div>Total Credit: <span className="font-semibold text-white">SAR {fmt(totalCredit)}</span></div>
          <div className={balanced ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
            {balanced ? 'Balanced ✓' : `Out of balance by SAR ${fmt(Math.abs(totalDebit - totalCredit))}`}
          </div>
        </div>
      </GlassCard>

      <div className="flex justify-end gap-2">
        <Link href="/journal-entries"><GlassButton variant="secondary">Cancel</GlassButton></Link>
        <GlassButton onClick={save} disabled={saving || !balanced}>{saving ? 'Saving…' : 'Save Draft'}</GlassButton>
      </div>
    </div>
  );
}
