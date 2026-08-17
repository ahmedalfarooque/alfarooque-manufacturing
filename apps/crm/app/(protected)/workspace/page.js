'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { GlassBadge, GlassSkeletonRows } from '@/components/glass';
import { SectionCard, CRMEmptyRow, InitialAvatar } from '@/components/CRMWidgets';

/* "My Workspace" — a personal filtered view over the existing list APIs.
   No new query params are added to /api/leads, /api/deals, /api/activities,
   /api/contacts — a large page is fetched once and filtered client-side by
   the signed-in user's id (assigned_to, falling back to created_by for
   older rows with no assignee), exactly as instructed. */
function mine(row, meId) {
  if (row.assigned_to) return row.assigned_to === meId;
  return row.created_by === meId;
}

export default function WorkspacePage() {
  const { t } = useLang();
  const [me, setMe] = useState(null);
  const [leads, setLeads] = useState(null);
  const [deals, setDeals] = useState(null);
  const [activities, setActivities] = useState(null);
  const [contacts, setContacts] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth', { credentials: 'same-origin' }).then(r => r.json()).then(body => {
      if (!cancelled) setMe(body.user || null);
    }).catch(() => { if (!cancelled) setMe(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/leads?pageSize=100').then(r => r.json()).catch(() => ({ leads: [] })),
      fetch('/api/deals?pageSize=100').then(r => r.json()).catch(() => ({ deals: [] })),
      fetch('/api/activities?pageSize=100').then(r => r.json()).catch(() => ({ activities: [] })),
      fetch('/api/contacts?pageSize=100').then(r => r.json()).catch(() => ({ contacts: [] })),
    ]).then(([l, d, a, c]) => {
      if (cancelled) return;
      setLeads(l.leads || []);
      setDeals(d.deals || []);
      setActivities(a.activities || []);
      setContacts(c.contacts || []);
    });
    return () => { cancelled = true; };
  }, []);

  const meId = me?.sub;
  const myLeads = (leads || []).filter(l => meId && mine(l, meId));
  const myDeals = (deals || []).filter(d => meId && mine(d, meId) && d.status === 'Open');
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const myFollowUps = (activities || []).filter(a => meId && mine(a, meId) && a.status === 'Planned' && a.activity_date && a.activity_date <= in7);
  const myContacts = (contacts || []).filter(c => meId && mine(c, meId));

  const loading = leads === null || deals === null || activities === null || contacts === null || me === null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('workspace')}</h1>
        <p className="text-sm text-[color:var(--tx-4)] mt-1">{me?.email ? `Signed in as ${me.email}` : ''}</p>
      </div>

      {me === false && (
        <SectionCard title="Not signed in"><CRMEmptyRow text="Could not resolve the current session." /></SectionCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="My Leads" subtitle={loading ? '' : `${myLeads.length} assigned to you`} action="View all" actionHref="/leads">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !myLeads.length ? <CRMEmptyRow text="No leads assigned to you." /> : (
            <div className="space-y-1">
              {myLeads.slice(0, 8).map(l => (
                <div key={l.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{l.name}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{l.company || '—'}</p>
                  </div>
                  <GlassBadge tone="cyan">{l.status}</GlassBadge>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="My Open Opportunities" subtitle={loading ? '' : `${myDeals.length} open`} action="View all" actionHref="/deals">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !myDeals.length ? <CRMEmptyRow text="No open opportunities assigned to you." /> : (
            <div className="space-y-1">
              {myDeals.slice(0, 8).map(d => (
                <Link key={d.id} href={`/deals/${d.id}`} className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded-lg hover:bg-[color:var(--pr-soft)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{d.title}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{d.stage}</p>
                  </div>
                  <span className="text-xs text-[color:var(--tx-3)] tabular-nums" dir="ltr">SAR {Number(d.value || 0).toLocaleString()}</span>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="My Follow-ups Due" subtitle={loading ? '' : `${myFollowUps.length} due within 7 days`} action="View all" actionHref="/activities">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !myFollowUps.length ? <CRMEmptyRow text="No follow-ups due." /> : (
            <div className="space-y-1">
              {myFollowUps.slice(0, 8).map(a => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{a.subject}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{a.activity_type}{a.crm_contacts?.name ? ` · ${a.crm_contacts.name}` : ''}</p>
                  </div>
                  <span className="text-xs text-[color:var(--tx-3)] tabular-nums" dir="ltr">{a.activity_date}{a.activity_date < today ? ' (overdue)' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="My Contacts" subtitle={loading ? '' : `${myContacts.length} assigned to you`} action="View all" actionHref="/contacts">
          {loading ? <GlassSkeletonRows rows={3} cols={2} /> : !myContacts.length ? <CRMEmptyRow text="No contacts assigned to you." /> : (
            <div className="space-y-1">
              {myContacts.slice(0, 8).map(c => (
                <Link key={c.id} href={c.source_table === 'customers' ? '/contacts' : `/contacts/${c.id}`} className="flex items-center gap-3 py-2 -mx-2 px-2 rounded-lg hover:bg-[color:var(--pr-soft)]">
                  <InitialAvatar name={c.name} size={28} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[color:var(--tx)] truncate">{c.name}</p>
                    <p className="text-xs text-[color:var(--tx-4)] truncate">{c.company || c.email || '—'}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
