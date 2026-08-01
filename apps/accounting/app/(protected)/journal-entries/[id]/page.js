'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, toast } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
function statusTone(s) { return s === 'Posted' ? 'success' : s === 'Voided' ? 'error' : 'neutral'; }

export default function JournalEntryDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, refresh } = useLiveData(`/api/journal-entries/${id}`, 0);

  async function action(act) {
    const label = act === 'post' ? 'Post' : 'Void';
    if (!confirm(`${label} this journal entry?`)) return;
    const res = await fetch(`/api/journal-entries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }),
    });
    const body = await res.json();
    if (!res.ok) { toast(body.error || `${label} failed`, 'error'); return; }
    toast(`Entry ${label.toLowerCase()}ed`, 'success');
    refresh();
  }

  async function del() {
    if (!confirm('Delete this journal entry?')) return;
    const res = await fetch(`/api/journal-entries/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); router.push('/journal-entries'); }
    else toast('Delete failed', 'error');
  }

  if (loading) return <div className="text-center text-slate-400 py-12">Loading…</div>;
  if (!data) return <div className="text-center text-slate-400 py-12">Entry not found.</div>;

  const { entry, lines } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/journal-entries"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
          <h1 className="text-2xl font-bold text-white">{entry.journal_number || entry.id.slice(0, 8)}</h1>
          <GlassBadge tone={statusTone(entry.status)}>{entry.status}</GlassBadge>
        </div>
        <div className="flex gap-2">
          {entry.status === 'Draft' && <GlassButton onClick={() => action('post')}>Post</GlassButton>}
          {entry.status !== 'Voided' && <GlassButton variant="secondary" onClick={() => action('void')}>Void</GlassButton>}
          {entry.status === 'Draft' && <GlassButton variant="danger" onClick={del}>Delete</GlassButton>}
        </div>
      </div>

      <GlassCard>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-slate-400">Date</p><p className="text-white">{entry.entry_date}</p></div>
          <div><p className="text-slate-400">Currency</p><p className="text-white">{entry.currency}</p></div>
          <div><p className="text-slate-400">Reference</p><p className="text-white">{entry.reference || '—'}</p></div>
          <div><p className="text-slate-400">Created By</p><p className="text-white">{entry.platform_users?.full_name || '—'}</p></div>
        </div>
        {entry.description && <p className="mt-3 text-slate-300 text-sm">{entry.description}</p>}
      </GlassCard>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Journal Lines</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-slate-400">Account</th>
              <th className="text-left py-2 px-3 text-slate-400">Description</th>
              <th className="text-right py-2 px-3 text-slate-400">Debit</th>
              <th className="text-right py-2 px-3 text-slate-400">Credit</th>
            </tr>
          </thead>
          <tbody>
            {lines.map(l => (
              <tr key={l.id} className="border-b border-white/5">
                <td className="py-2 px-3 text-white font-mono text-xs">
                  {l.acc_chart_of_accounts?.account_code} {l.acc_chart_of_accounts?.name}
                </td>
                <td className="py-2 px-3 text-slate-400">{l.description || '—'}</td>
                <td className="py-2 px-3 text-right text-white">{l.debit > 0 ? fmt(l.debit) : ''}</td>
                <td className="py-2 px-3 text-right text-slate-300">{l.credit > 0 ? fmt(l.credit) : ''}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/20">
              <td colSpan={2} className="py-2 px-3 text-slate-400 font-semibold">Total</td>
              <td className="py-2 px-3 text-right font-bold text-white">SAR {fmt(entry.total_debit)}</td>
              <td className="py-2 px-3 text-right font-bold text-slate-300">SAR {fmt(entry.total_credit)}</td>
            </tr>
          </tfoot>
        </table>
      </GlassCard>
    </div>
  );
}
