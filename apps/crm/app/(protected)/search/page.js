'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassInput, GlassBadge, GlassSkeletonRows } from '@/components/glass';
import { CRMEmptyState, SectionCard, CRMEmptyRow } from '@/components/CRMWidgets';

const TYPE_TONE = {
  'CRM Contact': 'cyan', 'CRM Lead': 'amber', 'CRM Deal': 'violet', 'QuotePro Quotation': 'emerald',
};

export default function SearchPage() {
  const { t } = useLang();
  const [input, setInput] = useState('');
  const q = input.trim();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (q.length < 2) { setData(null); return; }
    let cancelled = false;
    setData(null);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { credentials: 'same-origin' })
        .then(r => r.json())
        .then(body => { if (!cancelled) setData(body); })
        .catch(() => { if (!cancelled) setData({ results: [] }); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q]);

  const results = q.length >= 2 ? (data?.results || []) : [];
  const grouped = results.reduce((acc, r) => { (acc[r.type] = acc[r.type] || []).push(r); return acc; }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('search')}</h1>

      <GlassCard>
        <GlassInput
          autoFocus
          placeholder="Search contacts, leads, opportunities, quotations…"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
      </GlassCard>

      {q.length > 0 && q.length < 2 && (
        <p className="text-sm text-[color:var(--tx-4)] px-1">Type at least 2 characters to search.</p>
      )}

      {q.length >= 2 && !data && <GlassSkeletonRows rows={4} cols={3} />}

      {q.length >= 2 && data && !results.length && (
        <CRMEmptyState title="No results" text={`Nothing matched "${q}" across contacts, leads, opportunities, or quotations.`} />
      )}

      {q.length >= 2 && data && !!results.length && (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, rows]) => (
            <SectionCard key={type} title={type} subtitle={`${rows.length} match${rows.length === 1 ? '' : 'es'}`}>
              <div className="space-y-1">
                {rows.map(r => {
                  const inner = (
                    <div className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[color:var(--tx)] truncate">{r.label}</p>
                        {r.sublabel && <p className="text-xs text-[color:var(--tx-4)] truncate" dir="ltr">{r.sublabel}</p>}
                      </div>
                      <GlassBadge tone={TYPE_TONE[r.type] || 'neutral'}>{r.type}</GlassBadge>
                    </div>
                  );
                  return r.href
                    ? <Link key={`${r.type}-${r.id}`} href={r.href} className="block hover:bg-[color:var(--pr-soft)] rounded-lg px-2 -mx-2">{inner}</Link>
                    : <div key={`${r.type}-${r.id}`}>{inner}</div>;
                })}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}
