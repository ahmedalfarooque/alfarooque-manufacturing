'use strict';

/* /api/admin/quotes/replies — GET ?quoteId=<uuid> → reply/communication
   history for one quote. Attachment blobs are NOT included here (each
   reply already carries the recipient's copy via the email itself) —
   only name/mime/size, so opening a quote's history stays fast even
   with several replies attached (lazy: only fetched when the quote
   detail modal is opened, not on the Quotes list). */

const { getAdminClient } = require('../../_supabaseAdmin');
const { requireAdminSession } = require('../../_adminAuth');
const { sendRepliesError } = require('../../_quotesCore');

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);
  const quoteId = query.quoteId;
  if (!quoteId) return res.status(400).json({ error: 'Missing quoteId.' });

  const sb = getAdminClient();
  const { data, error } = await sb.from('quote_replies')
    .select('id, admin_name, to_email, subject, message, status, error, created_at, attachments')
    .eq('quote_id', quoteId).order('created_at', { ascending: false });
  if (error) return sendRepliesError(res, error);

  const replies = (data || []).map(r => Object.assign({}, r, {
    attachments: (r.attachments || []).map(a => ({ name: a.name, mime: a.mime, size: a.size })),
  }));

  return res.status(200).json({ replies });
};
