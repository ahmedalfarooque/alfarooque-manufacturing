'use strict';

/* /api/admin/customers
   GET    ?id=<uuid>                         → single customer (profile + auth + orders/addresses)
   GET    ?page=&pageSize=&search=           → paginated list
   PATCH  ?id=<uuid>  { disabled: true|false } → enable/disable sign-in
   DELETE ?id=<uuid>                          → permanently delete the account
   POST   { action:'reset-password', id }     → email a password-reset link
   POST   { action:'email-customer', id, subject, message } → send a custom email */

const mailer = require('../_email');
const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    if (query.id) return getOne(sb, query.id, res);
    return getList(sb, query, res);
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing customer id.' });
    const body = await readJsonBody(req);
    const disable = !!body.disabled;
    const { error } = await sb.auth.admin.updateUserById(id, { ban_duration: disable ? '87600h' : 'none' });
    if (error) return res.status(500).json({ error: error.message });
    await sb.from('profiles').update({ status: disable ? 'suspended' : 'active' }).eq('id', id);
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: disable ? 'customer.disable' : 'customer.enable', entityType: 'customer', entityId: id, req });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'DELETE') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing customer id.' });
    const { error } = await sb.auth.admin.deleteUser(id);
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'customer.delete', entityType: 'customer', entityId: id, req });
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.action === 'reset-password') return resetPassword(sb, admin, body, req, res);
    if (body.action === 'email-customer') return emailCustomer(sb, admin, body, req, res);
    return res.status(400).json({ error: 'Unknown action.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

async function getList(sb, query, res) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  const from = (page - 1) * pageSize, to = from + pageSize - 1;

  let q = sb.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (query.search) {
    const s = query.search.trim();
    q = q.or('first_name.ilike.%' + s + '%,last_name.ilike.%' + s + '%,full_name.ilike.%' + s + '%,company.ilike.%' + s + '%');
  }
  const { data: profiles, error, count } = await q.range(from, to);
  if (error) return res.status(500).json({ error: error.message });

  /* Resolve emails + last-sign-in from auth.users in one batched admin call */
  const { data: usersPage } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const userMap = {};
  (usersPage && usersPage.users || []).forEach(u => { userMap[u.id] = u; });

  const ids = (profiles || []).map(p => p.id);
  const [ordersCountRes, addrCountRes] = ids.length ? await Promise.all([
    sb.from('orders').select('user_id').in('user_id', ids),
    sb.from('addresses').select('user_id').in('user_id', ids),
  ]) : [{ data: [] }, { data: [] }];
  const ordersById = {}, addrById = {};
  (ordersCountRes.data || []).forEach(o => { ordersById[o.user_id] = (ordersById[o.user_id] || 0) + 1; });
  (addrCountRes.data || []).forEach(a => { addrById[a.user_id] = (addrById[a.user_id] || 0) + 1; });

  const rows = (profiles || []).map(p => {
    const u = userMap[p.id] || {};
    return {
      id: p.id,
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || '(no name)',
      email: u.email || '',
      phone: p.mobile || '',
      company: p.company || '',
      address: p.address || '',
      city: p.city || '',
      country: p.country || '',
      status: p.status || 'active',
      is_banned: !!(u.banned_until && new Date(u.banned_until) > new Date()),
      created_at: p.created_at,
      last_login: u.last_sign_in_at || null,
      email_verified: !!u.email_confirmed_at,
      orders_count: ordersById[p.id] || 0,
      addresses_count: addrById[p.id] || 0,
    };
  });
  if (query.search) {
    const s = query.search.trim().toLowerCase();
    /* also allow searching by email, which lives only in auth.users */
    const emailMatches = rows.filter(r => r.email.toLowerCase().includes(s));
    const merged = rows.filter(r => r.name.toLowerCase().includes(s) || (r.company || '').toLowerCase().includes(s));
    const seen = new Set();
    const combined = [...merged, ...emailMatches].filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));
    return res.status(200).json({ customers: combined, total: combined.length, page, pageSize });
  }
  return res.status(200).json({ customers: rows, total: count || 0, page, pageSize });
}

async function getOne(sb, id, res) {
  const { data: profile } = await sb.from('profiles').select('*').eq('id', id).maybeSingle();
  if (!profile) return res.status(404).json({ error: 'Customer not found.' });
  const { data: userRes } = await sb.auth.admin.getUserById(id);
  const u = (userRes && userRes.user) || {};
  const [ordersRes, addrRes] = await Promise.all([
    sb.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
    sb.from('addresses').select('*').eq('user_id', id),
  ]);
  return res.status(200).json({
    customer: {
      ...profile,
      email: u.email || '',
      last_login: u.last_sign_in_at || null,
      email_verified: !!u.email_confirmed_at,
      is_banned: !!(u.banned_until && new Date(u.banned_until) > new Date()),
    },
    orders: ordersRes.data || [],
    addresses: addrRes.data || [],
  });
}

async function resetPassword(sb, admin, body, req, res) {
  const id = body.id;
  if (!id) return res.status(400).json({ error: 'Missing customer id.' });
  const { data: userRes } = await sb.auth.admin.getUserById(id);
  const email = userRes && userRes.user && userRes.user.email;
  if (!email) return res.status(404).json({ error: 'Customer not found.' });
  const { data: linkData, error } = await sb.auth.admin.generateLink({ type: 'recovery', email });
  if (error) return res.status(500).json({ error: error.message });
  const link = linkData && linkData.properties && linkData.properties.action_link;
  try {
    await mailer.sendEmail({
      to: email, subject: 'Reset your AL FAROOQUE password',
      html: '<p>An administrator triggered a password reset for your account.</p><p><a href="' + link + '">Click here to set a new password</a></p><p>If you did not expect this, you can ignore this email.</p>',
    });
  } catch (err) { return res.status(500).json({ error: 'Could not send the reset email.' }); }
  await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'customer.reset_password', entityType: 'customer', entityId: id, req });
  return res.status(200).json({ ok: true });
}

async function emailCustomer(sb, admin, body, req, res) {
  const id = body.id, subject = String(body.subject || '').trim(), message = String(body.message || '').trim();
  if (!id || !subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });
  const { data: userRes } = await sb.auth.admin.getUserById(id);
  const email = userRes && userRes.user && userRes.user.email;
  if (!email) return res.status(404).json({ error: 'Customer not found.' });
  try {
    await mailer.sendEmail({ to: email, subject, html: '<div style="font-family:Arial,sans-serif;white-space:pre-wrap;">' + message.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])) + '</div>' });
  } catch (err) { return res.status(500).json({ error: 'Could not send the email.' }); }
  await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'customer.email_sent', entityType: 'customer', entityId: id, details: { subject }, req });
  return res.status(200).json({ ok: true });
}
