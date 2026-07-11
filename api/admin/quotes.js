'use strict';

/* /api/admin/quotes — every Quotes operation, routed by method + query/
   body, in ONE file. Consolidated from 6 separate files (quotes.js +
   quotes/{deleted,delete,recover,permanent,reply,replies}.js) purely to
   fit Vercel's Hobby-plan 12-serverless-function cap — the logic below
   is otherwise unchanged from those files (each responsibility stays
   its own function internally, nothing duplicated, just no longer
   routed as a separate file). See api/admin/orders.js for the same
   pattern applied to Orders.

   GET    ?id=<uuid>                        → single active quote
   GET    ?page=&pageSize=&status=          → active quotes list
   GET    ?deleted=1&page=&pageSize=&search=&status=&deletedBy=&dateFrom=&dateTo=&recovery=
                                             → Deleted Quotes list
   GET    ?replies=1&quoteId=<uuid>          → reply/communication history for a quote
   PATCH  ?id=<uuid>  { status?, admin_notes? }
   POST   { action:'convert-to-order', id }             → creates an order from the quote
   POST   { action:'delete', id }                       → soft delete
   POST   { action:'recover', id }                       → recover
   POST   { action:'permanent-delete', id }               → real DB delete, Super Admin only
   POST   { action:'reply', id, subject, message, attachments? } → email + Communication History */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');
const {
  ALLOWED_STATUSES, RECOVERY_WINDOW_DAYS,
  isSuperAdmin, attachDeletedByInfo, daysRemaining, sendQuotesError, hasSoftDelete, sendRepliesError,
} = require('../_quotesCore');
const mailer = require('../_email');

/* ── GET ?deleted=1 — Deleted Quotes list ── */
async function listDeletedQuotes(sb, query, res) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 15));

  if (!(await hasSoftDelete(sb))) {
    return res.status(200).json({ quotes: [], total: 0, page, pageSize, softDeleteEnabled: false });
  }

  const from = (page - 1) * pageSize, to = from + pageSize - 1;
  let q = sb.from('quotes')
    .select('id, name, email, phone, product, status, created_at, deleted_at, deleted_by, auto_delete_at', { count: 'exact' })
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false });

  if (query.search) {
    const s = query.search.trim();
    q = q.or('name.ilike.%' + s + '%,email.ilike.%' + s + '%,product.ilike.%' + s + '%');
  }
  if (query.status && query.status !== 'all') q = q.eq('status', query.status);
  if (query.deletedBy) q = q.eq('deleted_by', query.deletedBy);
  if (query.dateFrom) q = q.gte('deleted_at', new Date(query.dateFrom).toISOString());
  if (query.dateTo) {
    const end = new Date(query.dateTo); end.setHours(23, 59, 59, 999);
    q = q.lte('deleted_at', end.toISOString());
  }

  const { data, error, count } = await q.range(from, to);
  if (error) return sendQuotesError(res, error);

  let quotes = await attachDeletedByInfo(sb, data || []);
  quotes = quotes.map(qt => Object.assign({}, qt, { days_remaining: daysRemaining(qt) }));

  if (query.recovery && query.recovery !== 'all') {
    quotes = quotes.filter(qt => {
      if (query.recovery === 'green') return qt.days_remaining > 14;
      if (query.recovery === 'orange') return qt.days_remaining > 3 && qt.days_remaining <= 14;
      if (query.recovery === 'red') return qt.days_remaining <= 3;
      return true;
    });
  }

  return res.status(200).json({ quotes, total: count || 0, page, pageSize, softDeleteEnabled: true });
}

/* ── GET ?replies=1&quoteId= — Communication History ── */
async function listQuoteReplies(sb, quoteId, res) {
  if (!quoteId) return res.status(400).json({ error: 'Missing quoteId.' });
  const { data, error } = await sb.from('quote_replies')
    .select('id, admin_name, to_email, subject, message, status, error, created_at, attachments')
    .eq('quote_id', quoteId).order('created_at', { ascending: false });
  if (error) return sendRepliesError(res, error);

  const replies = (data || []).map(r => Object.assign({}, r, {
    attachments: (r.attachments || []).map(a => ({ name: a.name, mime: a.mime, size: a.size })),
  }));
  return res.status(200).json({ replies });
}

/* ── POST action:'delete' ── */
async function softDeleteQuote(sb, admin, id, req, res) {
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendQuotesError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Quote not found.' });
  if (existing.is_deleted) return res.status(400).json({ error: 'Quote is already deleted.' });

  const now = new Date();
  const autoDeleteAt = new Date(now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const { data, error } = await sb.from('quotes').update({
    is_deleted: true, deleted_at: now.toISOString(), deleted_by: admin.id,
    auto_delete_at: autoDeleteAt.toISOString(), recovered_at: null, recovered_by: null,
  }).eq('id', id).select().single();
  if (error) return sendQuotesError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.delete',
    entityType: 'quote', entityId: id, details: { name: existing.name, email: existing.email }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'quote', title: 'Quote Deleted',
    body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' deleted by ' + (admin.full_name || admin.email) + '.',
    link: '/pages/admin/dashboard.html#quotes-deleted',
  });

  return res.status(200).json({ quote: data });
}

/* ── POST action:'recover' ── */
async function recoverQuote(sb, admin, id, req, res) {
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendQuotesError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Quote not found.' });
  if (!existing.is_deleted) return res.status(400).json({ error: 'Quote is not deleted.' });

  const { data, error } = await sb.from('quotes').update({
    is_deleted: false, recovered_at: new Date().toISOString(), recovered_by: admin.id, auto_delete_at: null,
  }).eq('id', id).select().single();
  if (error) return sendQuotesError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.recover',
    entityType: 'quote', entityId: id, details: { name: existing.name, email: existing.email }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'quote', title: 'Quote Recovered',
    body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' restored successfully.',
    link: '/pages/admin/dashboard.html#quotes',
  });

  return res.status(200).json({ quote: data });
}

/* ── POST action:'permanent-delete' — Super Admin only ── */
async function permanentlyDeleteQuote(sb, admin, id, req, res) {
  if (!isSuperAdmin(admin)) return res.status(403).json({ error: 'Only a Super Admin can permanently delete a quote.' });
  if (!(await hasSoftDelete(sb))) return res.status(409).json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false });

  const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
  if (fetchError) return sendQuotesError(res, fetchError);
  if (!existing) return res.status(404).json({ error: 'Quote not found.' });
  if (!existing.is_deleted) return res.status(400).json({ error: 'Only a soft-deleted quote can be permanently deleted.' });

  const { error } = await sb.from('quotes').delete().eq('id', id);
  if (error) return sendQuotesError(res, error);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.permanent_delete',
    entityType: 'quote', entityId: id, details: { name: existing.name, email: existing.email }, req,
  });
  await sb.from('admin_notifications').insert({
    type: 'quote', title: 'Quote Permanently Deleted',
    body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' permanently deleted by ' + (admin.full_name || admin.email) + '.',
    link: '/pages/admin/dashboard.html#quotes-deleted',
  });

  return res.status(200).json({ ok: true });
}

/* ── POST action:'reply' — Reply to Customer + Communication History ── */
const REPLY_MAX_FILE_BYTES = 5 * 1024 * 1024;   // 5MB per attachment (decoded)
const REPLY_MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15MB combined (decoded)
const REPLY_MAX_FILES = 10;
function decodedSize(base64) {
  const clean = String(base64 || '').replace(/^data:[^,]+,/, '');
  return Math.floor(clean.length * 0.75);
}

async function replyToQuoteCustomer(sb, admin, body, req, res) {
  const id = body.id;
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const attachmentsIn = Array.isArray(body.attachments) ? body.attachments : [];

  if (!id) return res.status(400).json({ error: 'Missing quote id.' });
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });
  if (attachmentsIn.length > REPLY_MAX_FILES) return res.status(400).json({ error: 'Too many attachments (max ' + REPLY_MAX_FILES + ').' });

  let totalBytes = 0;
  const attachments = [];
  for (const a of attachmentsIn) {
    const name = String((a && a.name) || 'attachment').slice(0, 200);
    const mime = String((a && a.mime) || 'application/octet-stream').slice(0, 100);
    const dataBase64 = a && a.dataBase64;
    if (!dataBase64) return res.status(400).json({ error: 'Attachment "' + name + '" is missing file data.' });
    const size = decodedSize(dataBase64);
    if (size > REPLY_MAX_FILE_BYTES) return res.status(400).json({ error: 'Attachment "' + name + '" is too large (max ' + (REPLY_MAX_FILE_BYTES / 1024 / 1024) + 'MB).' });
    totalBytes += size;
    if (totalBytes > REPLY_MAX_TOTAL_BYTES) return res.status(400).json({ error: 'Attachments are too large in total (max ' + (REPLY_MAX_TOTAL_BYTES / 1024 / 1024) + 'MB).' });
    attachments.push({ name, mime, size, dataBase64 });
  }

  const { data: quote, error: fetchError } = await sb.from('quotes').select('id, name, email').eq('id', id).maybeSingle();
  if (fetchError) return res.status(500).json({ error: fetchError.message });
  if (!quote) return res.status(404).json({ error: 'Quote not found.' });
  if (!quote.email) return res.status(400).json({ error: 'This quote has no customer email on file.' });

  const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;white-space:pre-wrap;line-height:1.6">' +
    message.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) +
    '<hr style="margin:24px 0;border:none;border-top:1px solid #ddd">' +
    '<div style="color:#888;font-size:12px">' +
    'AL FAROOQUE Manufacturing — sent by ' + (admin.full_name || admin.email) + ' on ' + timestamp +
    '</div></div>';

  let sendStatus = 'sent', sendError = null;
  try {
    await mailer.sendEmail({
      to: quote.email, subject, html,
      attachments: attachments.map(a => ({ filename: a.name, contentBase64: a.dataBase64.replace(/^data:[^,]+,/, ''), mime: a.mime })),
    });
  } catch (err) {
    sendStatus = 'failed';
    sendError = err.message;
  }

  const { data: reply, error: insertError } = await sb.from('quote_replies').insert({
    quote_id: id, admin_id: admin.id, admin_name: admin.full_name || admin.email,
    to_email: quote.email, subject, message,
    attachments: attachments.map(a => ({ name: a.name, mime: a.mime, size: a.size, dataBase64: a.dataBase64 })),
    status: sendStatus, error: sendError,
  }).select('id, quote_id, admin_name, to_email, subject, message, status, error, created_at, attachments').single();
  if (insertError) return sendRepliesError(res, insertError);

  await logAudit(sb, {
    adminId: admin.id, adminEmail: admin.email, action: 'quote.reply_sent',
    entityType: 'quote', entityId: id, details: { subject, status: sendStatus }, req,
  });

  if (sendStatus === 'failed') return res.status(502).json({ error: 'Could not send the email: ' + sendError, reply });
  return res.status(200).json({ ok: true, reply });
}

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    if (query.deleted === '1') return listDeletedQuotes(sb, query, res);
    if (query.replies === '1') return listQuoteReplies(sb, query.quoteId, res);

    const softDeleteEnabled = await hasSoftDelete(sb);

    if (query.id) {
      let q = sb.from('quotes').select('*').eq('id', query.id);
      if (softDeleteEnabled) q = q.eq('is_deleted', false);
      const { data, error } = await q.maybeSingle();
      if (error) return sendQuotesError(res, error);
      if (!data) return res.status(404).json({ error: 'Quote not found.' });
      return res.status(200).json({ quote: data, softDeleteEnabled });
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const from = (page - 1) * pageSize, to = from + pageSize - 1;
    let q = sb.from('quotes').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (softDeleteEnabled) q = q.eq('is_deleted', false);
    if (query.status && query.status !== 'all') q = q.eq('status', query.status);
    const { data, error, count } = await q.range(from, to);
    if (error) return sendQuotesError(res, error);
    return res.status(200).json({ quotes: data || [], total: count || 0, page, pageSize, softDeleteEnabled });
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing quote id.' });
    const body = await readJsonBody(req);
    const softDeleteEnabled = await hasSoftDelete(sb);
    const patch = {};
    if (body.status !== undefined) {
      if (!ALLOWED_STATUSES.includes(body.status)) return res.status(400).json({ error: 'Invalid status.' });
      patch.status = body.status;
    }
    if (body.admin_notes !== undefined) patch.admin_notes = String(body.admin_notes || '').slice(0, 2000);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });
    let q = sb.from('quotes').update(patch).eq('id', id);
    if (softDeleteEnabled) q = q.eq('is_deleted', false);
    const { data, error } = await q.select().single();
    if (error) return sendQuotesError(res, error);
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'quote.update', entityType: 'quote', entityId: id, details: patch, req });
    return res.status(200).json({ quote: data });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);

    if (body.action === 'delete') return softDeleteQuote(sb, admin, body.id, req, res);
    if (body.action === 'recover') return recoverQuote(sb, admin, body.id, req, res);
    if (body.action === 'permanent-delete') return permanentlyDeleteQuote(sb, admin, body.id, req, res);
    if (body.action === 'reply') return replyToQuoteCustomer(sb, admin, body, req, res);

    if (body.action !== 'convert-to-order') return res.status(400).json({ error: 'Unknown action.' });
    const id = body.id;
    const softDeleteEnabled = await hasSoftDelete(sb);
    let existingQ = sb.from('quotes').select('*').eq('id', id);
    if (softDeleteEnabled) existingQ = existingQ.eq('is_deleted', false);
    const { data: quote, error: fetchError } = await existingQ.maybeSingle();
    if (fetchError) return sendQuotesError(res, fetchError);
    if (!quote) return res.status(404).json({ error: 'Quote not found.' });
    if (quote.order_id) return res.status(400).json({ error: 'This quote was already converted.' });

    const orderNo = 'ORD-' + Date.now().toString(36).toUpperCase();
    const { data: order, error: orderErr } = await sb.from('orders').insert({
      user_id: null,
      order_no: orderNo,
      status: 'pending',
      source: 'guest',
      guest_name: quote.name,
      guest_email: quote.email,
      guest_phone: quote.phone,
      items: quote.product ? [{ name: quote.product, qty: 1, price: 0 }] : [],
      subtotal: 0, vat: 0, grand_total: 0,
      admin_notes: 'Converted from quote #' + String(quote.id).slice(0, 8) + (quote.message ? ' — ' + quote.message : ''),
    }).select().single();
    if (orderErr) return res.status(500).json({ error: orderErr.message });

    await sb.from('quotes').update({ status: 'converted', order_id: order.id }).eq('id', id);
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'quote.convert_to_order', entityType: 'quote', entityId: id, details: { order_id: order.id }, req });
    return res.status(200).json({ order });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
