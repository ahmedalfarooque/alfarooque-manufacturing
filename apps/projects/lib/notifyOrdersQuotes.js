'use strict';

/* Fans a single Orders/Quotes event out to BOTH notification systems so
   it appears in both apps' bells:
   - public.admin_notifications — global feed read by the Website Admin
     (no user targeting; see api/admin/notifications.js on the main site).
   - public.notifications — per-user feed read by this app's Shell.js
     (requires a user_id; one row per admin platform_user so every admin
     here sees it, matching how quotation-requests notifies).
   Both are best-effort — a notification failure must never block the
   actual Order/Quote mutation that triggered it. */
async function notifyOrdersQuotes(sb, { type, title, body, adminLink, projectsLink }) {
  try {
    await sb.from('admin_notifications').insert({ type, title, body, link: adminLink });
  } catch (_) {}

  try {
    const { data: admins } = await sb.from('platform_users').select('id').eq('role', 'admin');
    if (admins && admins.length) {
      await sb.from('notifications').insert(
        admins.map(a => ({ user_id: a.id, type, title, body, link: projectsLink }))
      );
    }
  } catch (_) {}
}

module.exports = { notifyOrdersQuotes };
