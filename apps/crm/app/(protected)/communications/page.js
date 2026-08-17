'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { GlassBadge, GlassSkeletonRows } from '@/components/glass';
import { SectionCard, CRMEmptyRow } from '@/components/CRMWidgets';

const COMM_TYPES = ['Call', 'Email', 'Meeting'];
function statusTone(s) { return s === 'Completed' ? 'emerald' : s === 'Cancelled' || s === 'No Show' ? 'red' : 'cyan'; }
function integrationTone(status) { return status === 'connected' ? 'emerald' : status === 'error' ? 'red' : 'amber'; }

/* Per spec: no fake messaging UI. This page only surfaces (a) real
   configured-integration connection status for communication channels
   (same /api/integrations source the Integrations page and Dashboard's
   Integration Health card already use) and (b) communication-type
   activities already recorded via /api/activities. No compose/send UI. */
export default function CommunicationsPage() {
  const { t } = useLang();
  const [integrations, setIntegrations] = useState(null);
  const [activities, setActivities] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/integrations').then(r => r.json()).then(body => { if (!cancelled) setIntegrations(body.integrations || []); }).catch(() => { if (!cancelled) setIntegrations([]); });
    fetch('/api/activities?pageSize=100').then(r => r.json()).then(body => {
      if (cancelled) return;
      setActivities((body.activities || []).filter(a => COMM_TYPES.includes(a.activity_type)));
    }).catch(() => { if (!cancelled) setActivities([]); });
    return () => { cancelled = true; };
  }, []);

  const commIntegrations = (integrations || []).filter(i =>
    /email|whatsapp|mail/i.test(i.name || '') || /email|whatsapp/i.test(i.integration_key || '')
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('communications')}</h1>

      <SectionCard title="Communication Channels" subtitle="Configured integrations relevant to messaging">
        {integrations === null ? <GlassSkeletonRows rows={2} cols={3} /> : !commIntegrations.length ? (
          <CRMEmptyRow text="No email or WhatsApp integrations configured yet." />
        ) : (
          <div className="space-y-1">
            {commIntegrations.map(i => (
              <div key={i.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--tx)] truncate">{i.name}</p>
                  <p className="text-xs text-[color:var(--tx-4)] truncate">{i.provider || i.integration_key}</p>
                </div>
                <GlassBadge tone={integrationTone(i.status)}>{i.status || 'unknown'}</GlassBadge>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Recent Communications" subtitle="Calls, emails and meetings logged as activities">
        {activities === null ? <GlassSkeletonRows rows={4} cols={3} /> : !activities.length ? (
          <CRMEmptyRow text="No communication activities logged yet." />
        ) : (
          <div className="space-y-1">
            {activities.slice(0, 25).map(a => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[color:var(--tx)] truncate">{a.subject}</p>
                  <p className="text-xs text-[color:var(--tx-4)] truncate">
                    {a.activity_type}{a.crm_contacts?.name ? ` · ${a.crm_contacts.name}` : ''}{a.crm_deals?.title ? ` · ${a.crm_deals.title}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-[color:var(--tx-3)]" dir="ltr">{a.activity_date}</span>
                  <GlassBadge tone={statusTone(a.status)}>{a.status}</GlassBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
