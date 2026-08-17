'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLang } from '@/lib/i18n';
import { GlassCard, GlassButton, GlassBadge, GlassSkeletonRows } from '@/components/glass';

const TYPE_TONE = {
  Call: 'cyan', Meeting: 'violet', Email: 'amber', Demo: 'emerald', 'Follow-up': 'red', Task: 'slate', Note: 'neutral',
};

function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default function CalendarPage() {
  const { t } = useLang();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [activities, setActivities] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/activities?pageSize=100').then(r => r.json()).then(body => { if (!cancelled) setActivities(body.activities || []); }).catch(() => { if (!cancelled) setActivities([]); });
    return () => { cancelled = true; };
  }, []);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const a of activities || []) {
      if (!a.activity_date) continue;
      const key = String(a.activity_date).slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(a);
    }
    return map;
  }, [activities]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = ymd(new Date());

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-[color:var(--tx)]">{t('calendar')}</h1>
        <div className="flex items-center gap-2">
          <GlassButton variant="secondary" size="sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</GlassButton>
          <span className="text-sm font-medium text-[color:var(--tx-2)] min-w-[9rem] text-center">
            {cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <GlassButton variant="secondary" size="sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>›</GlassButton>
          <GlassButton variant="secondary" size="sm" onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); }}>Today</GlassButton>
        </div>
      </div>

      <GlassCard>
        {activities === null ? <GlassSkeletonRows rows={5} cols={7} /> : (
          <div className="grid grid-cols-7 gap-1.5">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="text-[11px] uppercase tracking-wider text-[color:var(--tx-4)] font-semibold text-center py-1">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (day === null) return <div key={`e${i}`} className="min-h-[92px] rounded-lg" />;
              const key = `${year}-${pad(month + 1)}-${pad(day)}`;
              const items = byDay.get(key) || [];
              const isToday = key === todayStr;
              return (
                <div key={key} className={'min-h-[92px] rounded-lg border p-1.5 flex flex-col gap-1 ' + (isToday ? 'border-[color:var(--pr)] bg-[color:var(--pr-soft)]' : 'border-[color:var(--bd)]')}>
                  <span className={'text-xs font-medium ' + (isToday ? 'text-[color:var(--pr)]' : 'text-[color:var(--tx-3)]')}>{day}</span>
                  <div className="flex-1 space-y-1 overflow-y-auto max-h-[70px]">
                    {items.slice(0, 3).map(a => (
                      <div key={a.id} className="text-[10px] leading-tight truncate">
                        <GlassBadge tone={TYPE_TONE[a.activity_type] || 'neutral'} className="!text-[10px] !px-1.5 !py-0.5">{a.subject}</GlassBadge>
                      </div>
                    ))}
                    {items.length > 3 && <div className="text-[10px] text-[color:var(--tx-4)]">+{items.length - 3} more</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
