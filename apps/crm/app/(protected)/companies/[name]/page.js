'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useLiveData } from '@/lib/useLiveData';
import { GlassCard, GlassBadge, GlassTh, GlassTd, GlassSkeletonRows } from '@/components/glass';
import { InitialAvatar, SectionCard, CRMEmptyRow } from '@/components/CRMWidgets';

function fmt(n) { return Number(n || 0).toLocaleString('en-SA', { minimumFractionDigits: 2 }); }
function dealTone(s) { return s === 'Won' ? 'emerald' : s === 'Lost' ? 'red' : s === 'On Hold' ? 'amber' : 'cyan'; }

export default function CompanyDetailPage() {
  const params = useParams();
  const name = decodeURIComponent(params.name || '');
  const { data } = useLiveData(`/api/companies/${encodeURIComponent(name)}`, 20000);
  const contacts = data?.contacts || [];
  const deals = data?.deals || [];

  return (
    <div className="space-y-4">
      <div>
        <Link href="/companies" className="text-xs text-[color:var(--pr)] hover:underline">← Companies</Link>
        <h1 className="text-2xl font-bold text-[color:var(--tx)] mt-1">{name}</h1>
      </div>

      <SectionCard title="Contacts" subtitle={`${contacts.length} at ${name}`}>
        {!data ? (
          <GlassSkeletonRows rows={4} cols={3} />
        ) : !contacts.length ? (
          <CRMEmptyRow text="No contacts found for this company." />
        ) : (
          <div className="space-y-1">
            {contacts.map(c => {
              const inner = (
                <div className="flex items-center gap-3 py-2">
                  <InitialAvatar name={c.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{c.name}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{c.email || c.phone || '—'}</p>
                  </div>
                  {c.contact_type && <GlassBadge tone="cyan">{c.contact_type}</GlassBadge>}
                </div>
              );
              return c.source_table === 'customers'
                ? <div key={c.id}>{inner}</div>
                : <Link key={c.id} href={`/contacts/${c.id}`} className="block hover:bg-[color:var(--pr-soft)] rounded-lg px-2 -mx-2">{inner}</Link>;
            })}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Opportunities" subtitle={`${deals.length} linked to contacts at ${name}`}>
        {!data ? (
          <GlassSkeletonRows rows={4} cols={4} />
        ) : !deals.length ? (
          <CRMEmptyRow text="No opportunities linked to this company yet." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--bd)]">
                <GlassTh>Title</GlassTh>
                <GlassTh>Stage</GlassTh>
                <GlassTh>Status</GlassTh>
                <GlassTh>Value</GlassTh>
              </tr>
            </thead>
            <tbody>
              {deals.map(d => (
                <tr key={d.id} className="border-b border-[color:var(--bd)] hover:bg-[color:var(--pr-soft)]">
                  <GlassTd className="font-medium text-[color:var(--tx)]"><Link href={`/deals/${d.id}`} className="hover:text-[color:var(--pr)]">{d.title}</Link></GlassTd>
                  <GlassTd className="text-[color:var(--tx-3)]">{d.stage}</GlassTd>
                  <GlassTd><GlassBadge tone={dealTone(d.status)}>{d.status}</GlassBadge></GlassTd>
                  <GlassTd dir="ltr" className="text-[color:var(--tx-3)]">SAR {fmt(d.value)}</GlassTd>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
