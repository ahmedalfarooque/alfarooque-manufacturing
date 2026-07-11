'use strict';

/* /api/admin/quotes/reply — POST { id, subject, message, attachments? }
   Sends an email to the quote's customer via the existing configured
   email provider (api/_email.js — Resend or SMTP, whichever this site
   already uses) and stores the reply in public.quote_replies so it shows
   up under "Communication History" on the quote's detail view.

   attachments (optional): [{ name, mime, dataBase64 }] — small files
   only (see MAX_FILE_BYTES/MAX_TOTAL_BYTES below); sent as real email
   attachments AND kept alongside the reply row for history, not
   uploaded to storage (see supabase/schema-quotes-soft-delete.sql for
   why: no Storage bucket to provision for a first pass). */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../../_adminAuth');
const { sendRepliesError } = require('../../_quotesCore');
const mailer = require('../../_email');

const MAX_FILE_BYTES = 5 * 1024 * 1024;   // 5MB per attachment (decoded)
const MAX_TOTAL_BYTES = 15 * 1024 * 1024; // 15MB combined (decoded)
const MAX_FILES = 10;

function decodedSize(base64) {
  const clean = String(base64 || '').replace(/^data:[^,]+,/, '');
  return Math.floor(clean.length * 0.75);
}

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = await readJsonBody(req);
  const id = body.id;
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();
  const attachmentsIn = Array.isArray(body.attachments) ? body.attachments : [];

  if (!id) return res.status(400).json({ error: 'Missing quote id.' });
  if (!subject || !message) return res.status(400).json({ error: 'Subject and message are required.' });
  if (attachmentsIn.length > MAX_FILES) return res.status(400).json({ error: 'Too many attachments (max ' + MAX_FILES + ').' });

  let totalBytes = 0;
  const attachments = [];
  for (const a of attachmentsIn) {
    const name = String((a && a.name) || 'attachment').slice(0, 200);
    const mime = String((a && a.mime) || 'application/octet-stream').slice(0, 100);
    const dataBase64 = a && a.dataBase64;
    if (!dataBase64) return res.status(400).json({ error: 'Attachment "' + name + '" is missing file data.' });
    const size = decodedSize(dataBase64);
    if (size > MAX_FILE_BYTES) return res.status(400).json({ error: 'Attachment "' + name + '" is too large (max ' + (MAX_FILE_BYTES / 1024 / 1024) + 'MB).' });
    totalBytes += size;
    if (totalBytes > MAX_TOTAL_BYTES) return res.status(400).json({ error: 'Attachments are too large in total (max ' + (MAX_TOTAL_BYTES / 1024 / 1024) + 'MB).' });
    attachments.push({ name, mime, size, dataBase64 });
  }

  const sb = getAdminClient();
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
      to: quote.email, subject,
      html,
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
};
