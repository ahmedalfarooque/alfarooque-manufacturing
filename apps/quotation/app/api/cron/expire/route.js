'use strict';

/* Expiry sweep (BR-6): approved/sent quotations past valid_until become
   'expired' and the salesperson is notified. Invoked by Vercel Cron
   (vercel.json) — Vercel sends Authorization: Bearer CRON_SECRET — or
   manually by an admin session. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { logEvent } = require('@/lib/quotes');

export async function GET(req) {
  const auth = req.headers.get('authorization') || '';
  const cronOk = process.env.CRON_SECRET && auth === 'Bearer ' + process.env.CRON_SECRET;
  if (!cronOk) {
    const { session, response } = await requireWrite(req);
    if (!session) return response;
  }

  const sb = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const { data: rows, error } = await sb.from('qt_quotations')
    .select('id, quote_number, salesperson_id')
    .in('status', ['approved', 'sent'])
    .lt('valid_until', today)
    .is('deleted_at', null);
  if (error) return json({ error: error.message }, 500);

  let expired = 0;
  for (const r of rows || []) {
    const { error: uErr } = await sb.from('qt_quotations')
      .update({ status: 'expired', updated_at: new Date().toISOString() }).eq('id', r.id);
    if (uErr) continue;
    expired++;
    await logEvent(sb, r.id, 'expired', { on: today }, null);
    if (r.salesperson_id) {
      await sb.from('qt_notifications').insert({
        user_id: r.salesperson_id, type: 'warning',
        title: 'Quotation expired — ' + r.quote_number,
        body: 'Validity passed on ' + today + '. Consider a new revision.',
        link: '/quotations/' + r.id,
      }).then(() => {}, () => {});
    }
  }
  return json({ checked: (rows || []).length, expired });
}
