'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassButton, GlassInput, GlassSelect, GlassPagination, GlassTh, GlassTd } from '@/components/glass';

const STATUSES = ['Draft', 'Posted', 'Voided'];

function statusTone(s) { return s === 'Posted' ? 'success' : s === 'Voided' ? 'error' : 'neutral'; }
function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }

export default function JournalEntriesPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const params = new URLSearchParams({ page, pageSize });
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  const { data } = useLiveData(`/api/journal-entries?${params}`, 15000);
  const entries = data?.entries || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Journal Entries</h1>
        <Link href="/journal-entries/new">
          <GlassButton>+ New Entry</GlassButton>
        </Link>
      </div>

      <GlassCard>
        <div className="flex gap-3 mb-4">
          <GlassInput placeholder="Search number or description…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1" />
          <GlassSelect value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s}>{s}</option>)}
          </GlassSelect>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <GlassTh>Number</GlassTh>
              <GlassTh>Date</GlassTh>
              <GlassTh>Description</GlassTh>
              <GlassTh>Debit</GlassTh>
              <GlassTh>Status</GlassTh>
              <GlassTh></GlassTh>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} className="border-b border-white/5 hover:bg-white/5">
                <GlassTd className="font-mono">{e.journal_number || e.id.slice(0, 8)}</GlassTd>
                <GlassTd>{e.entry_date}</GlassTd>
                <GlassTd className="text-slate-400">{e.description || '—'}</GlassTd>
                <GlassTd>SAR {fmt(e.total_debit)}</GlassTd>
                <GlassTd><GlassBadge tone={statusTone(e.status)}>{e.status}</GlassBadge></GlassTd>
                <GlassTd>
                  <Link href={`/journal-entries/${e.id}`}>
                    <GlassButton variant="secondary" size="sm">View</GlassButton>
                  </Link>
                </GlassTd>
              </tr>
            ))}
            {!entries.length && (
              <tr><td colSpan={6} className="text-center text-slate-500 py-8">No entries found.</td></tr>
            )}
          </tbody>
        </table>

        <GlassPagination page={page} pageSize={pageSize} total={data?.total || 0} onPage={setPage} />
      </GlassCard>
    </div>
  );
}
