'use strict';

/* Quotes module, shared with the Website Admin via the same public.quotes
   / public.quote_replies tables (see apps/projects/lib/ordersQuotesCore.js).

   GET  (no params)                      -> active quotes list
   GET  ?deleted=1                       -> Deleted Quotes list
   GET  ?replies=1&quoteId=<uuid>          -> Communication History
   POST { action:'delete', id }
   POST { action:'recover', id }
   POST { action:'permanent-delete', id }  -> Super Admin only
   POST { action:'reply', id, subject, message, attachments? }
   POST { action:'convert-to-order', id } */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { RECOVERY_WINDOW_DAYS, isSuperAdmin, hasSoftDelete, logError, daysRemaining, attachActorNames } = require('@/lib/ordersQuotesCore');
const { notifyOrdersQuotes } = require('@/lib/notifyOrdersQuotes');
const mailer = require('@/lib/email');

async function listDeleted(sb, url) {
  const softDeleteEnabled = await hasSoftDelete(sb, 'quotes');
  if (!softDeleteEnabled) return json({ quotes: [], softDeleteEnabled: false });

  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';
  const recovery = url.searchParams.get('recovery') || 'all';

  let q = sb.from('quotes')
    .select('id, name, email, phone, product, status, created_at, deleted_at, deleted_by, auto_delete_at')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false });
  if (search) q = q.or('name.ilike.%' + search + '%,email.ilike.%' + search + '%,product.ilike.%' + search + '%');
  if (status !== 'all') q = q.eq('status', status);

  const { data, error } = await q;
  if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);

  let quotes = await attachActorNames(sb, data || [], 'deleted_by', 'deleted_by_name');
  quotes = quotes.map(qt => Object.assign({}, qt, { days_remaining: daysRemaining(qt) }));

  if (recovery !== 'all') {
    quotes = quotes.filter(qt => {
      if (recovery === 'green') return qt.days_remaining > 14;
      if (recovery === 'orange') return qt.days_remaining > 3 && qt.days_remaining <= 14;
      if (recovery === 'red') return qt.days_remaining <= 3;
      return true;
    });
  }

  return json({ quotes, softDeleteEnabled: true });
}

async function listReplies(sb, quoteId) {
  if (!quoteId) return json({ error: 'Missing quoteId.' }, 400);
  const { data, error } = await sb.from('quote_replies')
    .select('id, admin_name, to_email, subject, message, status, error, created_at, attachments')
    .eq('quote_id', quoteId).order('created_at', { ascending: false });
  if (error) return json({ error: logError('quotes:replies', error, 'Quote reply history') }, 500);
  const replies = (data || []).map(r => Object.assign({}, r, {
    attachments: (r.attachments || []).map(a => ({ name: a.name, mime: a.mime, size: a.size })),
  }));
  return json({ replies });
}

export async function GET(req) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const url = new URL(req.url);
  if (url.searchParams.get('deleted') === '1') return listDeleted(sb, url);
  if (url.searchParams.get('replies') === '1') return listReplies(sb, url.searchParams.get('quoteId'));

  const softDeleteEnabled = await hasSoftDelete(sb, 'quotes');
  const search = url.searchParams.get('search') || '';
  const status = url.searchParams.get('status') || 'all';

  let q = sb.from('quotes').select('*').order('created_at', { ascending: false });
  if (softDeleteEnabled) q = q.eq('is_deleted', false);
  if (status !== 'all') q = q.eq('status', status);
  if (search) q = q.or('name.ilike.%' + search + '%,email.ilike.%' + search + '%,product.ilike.%' + search + '%');

  const { data, error } = await q.limit(500);
  if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);
  return json({ quotes: data || [], softDeleteEnabled });
}

const REPLY_MAX_FILE_BYTES = 5 * 1024 * 1024;
const REPLY_MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const REPLY_MAX_FILES = 10;
function decodedSize(base64) {
  return Math.floor(String(base64 || '').replace(/^data:[^,]+,/, '').length * 0.75);
}

async function replyToCustomer(sb, session, body) {
  const id = body.id;
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const attachmentsIn = Array.isArray(body.attachments) ? body.attachments : [];
  if (!id) return json({ error: 'Missing quote id.' }, 400);
  if (!subject || !message) return json({ error: 'Subject and message are required.' }, 400);
  if (attachmentsIn.length > REPLY_MAX_FILES) return json({ error: 'Too many attachments (max ' + REPLY_MAX_FILES + ').' }, 400);

  let totalBytes = 0;
  const attachments = [];
  for (const a of attachmentsIn) {
    const name = String((a && a.name) || 'attachment').slice(0, 200);
    const mime = String((a && a.mime) || 'application/octet-stream').slice(0, 100);
    const dataBase64 = a && a.dataBase64;
    if (!dataBase64) return json({ error: 'Attachment "' + name + '" is missing file data.' }, 400);
    const size = decodedSize(dataBase64);
    if (size > REPLY_MAX_FILE_BYTES) return json({ error: 'Attachment "' + name + '" is too large (max 5MB).' }, 400);
    totalBytes += size;
    if (totalBytes > REPLY_MAX_TOTAL_BYTES) return json({ error: 'Attachments are too large in total (max 15MB).' }, 400);
    attachments.push({ name, mime, size, dataBase64 });
  }

  const { data: quote, error: fetchError } = await sb.from('quotes').select('id, name, email').eq('id', id).maybeSingle();
  if (fetchError) return json({ error: logError('quotes:reply', fetchError, 'Quotes') }, 500);
  if (!quote) return json({ error: 'Quote not found.' }, 404);
  if (!quote.email) return json({ error: 'This quote has no customer email on file.' }, 400);

  const timestamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const html =
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#222;white-space:pre-wrap;line-height:1.6">' +
    message.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])) +
    '<hr style="margin:24px 0;border:none;border-top:1px solid #ddd">' +
    '<div style="color:#888;font-size:12px">AL FAROOQUE Manufacturing — sent by ' + session.email + ' on ' + timestamp + '</div></div>';

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
    quote_id: id, admin_id: null, admin_name: session.email,
    to_email: quote.email, subject, message,
    attachments: attachments.map(a => ({ name: a.name, mime: a.mime, size: a.size, dataBase64: a.dataBase64 })),
    status: sendStatus, error: sendError,
  }).select('id, quote_id, admin_name, to_email, subject, message, status, error, created_at, attachments').single();
  if (insertError) return json({ error: logError('quotes:reply', insertError, 'Quote reply history') }, 500);

  if (sendStatus === 'failed') return json({ error: 'Could not send the email: ' + sendError, reply }, 502);
  return json({ ok: true, reply });
}

export async function POST(req) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const body = await req.json().catch(() => ({}));
  const sb = getDb();
  const id = body.id;

  if (body.action === 'reply') return replyToCustomer(sb, session, body);

  if (body.action === 'delete') {
    if (!id) return json({ error: 'Missing quote id.' }, 400);
    if (!(await hasSoftDelete(sb, 'quotes'))) return json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false }, 409);
    const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
    if (fetchError) return json({ error: logError('quotes', fetchError, 'Quotes') }, 500);
    if (!existing) return json({ error: 'Quote not found.' }, 404);
    if (existing.is_deleted) return json({ error: 'Quote is already deleted.' }, 400);

    const now = new Date();
    const autoDeleteAt = new Date(now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const { data, error } = await sb.from('quotes').update({
      is_deleted: true, deleted_at: now.toISOString(), deleted_by: session.sub,
      auto_delete_at: autoDeleteAt.toISOString(), recovered_at: null, recovered_by: null,
    }).eq('id', id).select().single();
    if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);

    await notifyOrdersQuotes(sb, {
      type: 'quote', title: 'Quote Deleted',
      body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' deleted by ' + session.email + ' (Projects).',
      adminLink: '/pages/admin/dashboard.html#quotes-deleted', projectsLink: '/quotes-deleted',
    });
    return json({ quote: data });
  }

  if (body.action === 'recover') {
    if (!id) return json({ error: 'Missing quote id.' }, 400);
    if (!(await hasSoftDelete(sb, 'quotes'))) return json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false }, 409);
    const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
    if (fetchError) return json({ error: logError('quotes', fetchError, 'Quotes') }, 500);
    if (!existing) return json({ error: 'Quote not found.' }, 404);
    if (!existing.is_deleted) return json({ error: 'Quote is not deleted.' }, 400);

    const { data, error } = await sb.from('quotes').update({
      is_deleted: false, recovered_at: new Date().toISOString(), recovered_by: session.sub, auto_delete_at: null,
    }).eq('id', id).select().single();
    if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);

    await notifyOrdersQuotes(sb, {
      type: 'quote', title: 'Quote Recovered',
      body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' restored successfully.',
      adminLink: '/pages/admin/dashboard.html#quotes', projectsLink: '/quotes',
    });
    return json({ quote: data });
  }

  if (body.action === 'permanent-delete') {
    if (!id) return json({ error: 'Missing quote id.' }, 400);
    if (!isSuperAdmin(session)) return json({ error: 'Only a Super Admin can permanently delete a quote.' }, 403);
    if (!(await hasSoftDelete(sb, 'quotes'))) return json({ error: 'Soft Delete feature has not been enabled yet.', softDeleteEnabled: false }, 409);
    const { data: existing, error: fetchError } = await sb.from('quotes').select('id, name, email, is_deleted').eq('id', id).maybeSingle();
    if (fetchError) return json({ error: logError('quotes', fetchError, 'Quotes') }, 500);
    if (!existing) return json({ error: 'Quote not found.' }, 404);
    if (!existing.is_deleted) return json({ error: 'Only a soft-deleted quote can be permanently deleted.' }, 400);

    const { error } = await sb.from('quotes').delete().eq('id', id);
    if (error) return json({ error: logError('quotes', error, 'Quotes') }, 500);

    await notifyOrdersQuotes(sb, {
      type: 'quote', title: 'Quote Permanently Deleted',
      body: 'Quote from ' + (existing.name || existing.email || id.slice(0, 8)) + ' permanently deleted by ' + session.email + '.',
      adminLink: '/pages/admin/dashboard.html#quotes-deleted', projectsLink: '/quotes-deleted',
    });
    return json({ ok: true });
  }

  if (body.action === 'convert-to-order') {
    if (!id) return json({ error: 'Missing quote id.' }, 400);
    const softDeleteEnabled = await hasSoftDelete(sb, 'quotes');
    let existingQ = sb.from('quotes').select('*').eq('id', id);
    if (softDeleteEnabled) existingQ = existingQ.eq('is_deleted', false);
    const { data: quote, error: fetchError } = await existingQ.maybeSingle();
    if (fetchError) return json({ error: logError('quotes', fetchError, 'Quotes') }, 500);
    if (!quote) return json({ error: 'Quote not found.' }, 404);
    if (quote.order_id) return json({ error: 'This quote was already converted.' }, 400);

    const orderNo = 'ORD-' + Date.now().toString(36).toUpperCase();
    const { data: order, error: orderErr } = await sb.from('orders').insert({
      user_id: null, order_no: orderNo, status: 'pending', source: 'guest',
      guest_name: quote.name, guest_email: quote.email, guest_phone: quote.phone,
      items: quote.product ? [{ name: quote.product, qty: 1, price: 0 }] : [],
      subtotal: 0, vat: 0, grand_total: 0,
      admin_notes: 'Converted from quote #' + String(quote.id).slice(0, 8) + (quote.message ? ' — ' + quote.message : '') + ' (via Projects)',
    }).select().single();
    if (orderErr) return json({ error: orderErr.message }, 500);

    await sb.from('quotes').update({ status: 'converted', order_id: order.id }).eq('id', id);
    return json({ order });
  }

  return json({ error: 'Unknown action.' }, 400);
}
