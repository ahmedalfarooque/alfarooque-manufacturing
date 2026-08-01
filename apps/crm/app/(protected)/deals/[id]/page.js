'use client';

import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, toast } from '@/components/glass';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
function statusTone(s) { return s === 'Won' ? 'success' : s === 'Lost' ? 'error' : s === 'On Hold' ? 'warning' : 'info'; }

export default function DealDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data, loading, refresh } = useLiveData(`/api/deals/${id}`, 0);

  if (loading) return <div className="text-center text-slate-400 py-12">Loading…</div>;
  if (!data) return <div className="text-center text-slate-400 py-12">Deal not found.</div>;

  const { deal, activities } = data;

  async function setStatus(status, stage) {
    const patch = { status };
    if (stage) patch.stage = stage;
    const res = await fetch(`/api/deals/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    if (res.ok) { toast('Updated', 'success'); refresh(); }
    else toast('Update failed', 'error');
  }

  async function del() {
    if (!confirm('Delete this deal?')) return;
    const res = await fetch(`/api/deals/${id}`, { method: 'DELETE' });
    if (res.ok) { toast('Deleted', 'success'); router.push('/deals'); }
    else toast('Delete failed', 'error');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/deals"><GlassButton variant="secondary" size="sm">← Back</GlassButton></Link>
          <h1 className="text-2xl font-bold text-white">{deal.title}</h1>
          <GlassBadge tone={statusTone(deal.status)}>{deal.status}</GlassBadge>
        </div>
        <div className="flex gap-2">
          {deal.status === 'Open' && (
            <>
              <GlassButton onClick={() => setStatus('Won', 'Closed Won')}>Mark Won</GlassButton>
              <GlassButton variant="secondary" onClick={() => setStatus('Lost', 'Closed Lost')}>Mark Lost</GlassButton>
            </>
          )}
          <GlassButton variant="danger" onClick={del}>Delete</GlassButton>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard className="lg:col-span-2">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Deal Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="text-slate-400">Value</p><p className="text-2xl font-bold text-cyan-400">SAR {fmt(deal.value)}</p></div>
            <div><p className="text-slate-400">Stage</p><p className="text-white font-medium">{deal.stage}</p></div>
            <div><p className="text-slate-400">Probability</p><p className="text-white">{deal.probability || 0}%</p></div>
            <div><p className="text-slate-400">Expected Close</p><p className="text-white">{deal.expected_close_date || '—'}</p></div>
            <div><p className="text-slate-400">Currency</p><p className="text-white">{deal.currency}</p></div>
          </div>
          {deal.description && <p className="mt-3 text-slate-300 text-sm">{deal.description}</p>}
        </GlassCard>

        <GlassCard>
          <h3 className="text-sm font-semibold text-slate-300 mb-3">Contact</h3>
          {deal.crm_contacts ? (
            <div className="text-sm">
              <Link href={`/contacts/${deal.contact_id}`} className="text-cyan-400 hover:text-cyan-300 font-medium">{deal.crm_contacts.name}</Link>
              {deal.crm_contacts.company && <p className="text-slate-400 mt-1">{deal.crm_contacts.company}</p>}
              {deal.crm_contacts.email && <p className="text-slate-500 mt-1">{deal.crm_contacts.email}</p>}
              {deal.crm_contacts.phone && <p className="text-slate-500">{deal.crm_contacts.phone}</p>}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No contact linked.</p>
          )}
        </GlassCard>
      </div>

      <GlassCard>
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Activities ({activities.length})</h3>
        {!activities.length ? <p className="text-slate-500 text-sm">No activities logged.</p> : (
          <div className="divide-y divide-white/5">
            {activities.map(a => (
              <div key={a.id} className="py-2 flex items-center justify-between text-sm">
                <div>
                  <span className="text-white">{a.subject}</span>
                  {a.notes && <p className="text-slate-400 text-xs mt-0.5">{a.notes}</p>}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <GlassBadge tone="neutral">{a.activity_type}</GlassBadge>
                  <span className="text-slate-500">{a.activity_date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
