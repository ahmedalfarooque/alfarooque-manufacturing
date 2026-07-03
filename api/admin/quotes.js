'use strict';

/* /api/admin/quotes
   GET   ?id=<uuid>                     → single quote
   GET   ?page=&pageSize=&status=       → paginated list
   PATCH ?id=<uuid>  { status?, admin_notes? }
   POST  { action:'convert-to-order', id } → creates an order from the quote */

const { getAdminClient } = require('../_supabaseAdmin');
const { requireAdminSession, readJsonBody, logAudit } = require('../_adminAuth');

const ALLOWED = ['new', 'contacted', 'quoted', 'converted', 'closed'];

module.exports = async function handler(req, res) {
  const admin = await requireAdminSession(req, res);
  if (!admin) return;
  const sb = getAdminClient();
  const query = req.query || Object.fromEntries(new URL(req.url, 'http://x').searchParams);

  if (req.method === 'GET') {
    if (query.id) {
      const { data, error } = await sb.from('quotes').select('*').eq('id', query.id).maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: 'Quote not found.' });
      return res.status(200).json({ quote: data });
    }
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
    const from = (page - 1) * pageSize, to = from + pageSize - 1;
    let q = sb.from('quotes').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (query.status && query.status !== 'all') q = q.eq('status', query.status);
    const { data, error, count } = await q.range(from, to);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ quotes: data || [], total: count || 0, page, pageSize });
  }

  if (req.method === 'PATCH') {
    const id = query.id;
    if (!id) return res.status(400).json({ error: 'Missing quote id.' });
    const body = await readJsonBody(req);
    const patch = {};
    if (body.status !== undefined) {
      if (!ALLOWED.includes(body.status)) return res.status(400).json({ error: 'Invalid status.' });
      patch.status = body.status;
    }
    if (body.admin_notes !== undefined) patch.admin_notes = String(body.admin_notes || '').slice(0, 2000);
    if (!Object.keys(patch).length) return res.status(400).json({ error: 'Nothing to update.' });
    const { data, error } = await sb.from('quotes').update(patch).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await logAudit(sb, { adminId: admin.id, adminEmail: admin.email, action: 'quote.update', entityType: 'quote', entityId: id, details: patch, req });
    return res.status(200).json({ quote: data });
  }

  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.action !== 'convert-to-order') return res.status(400).json({ error: 'Unknown action.' });
    const id = body.id;
    const { data: quote } = await sb.from('quotes').select('*').eq('id', id).maybeSingle();
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
