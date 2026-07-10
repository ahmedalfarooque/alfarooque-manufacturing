'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { getSetting, logEvent } = require('@/lib/quotes');

const PAGE_SIZE = 25;

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const status = url.searchParams.get('status') || '';
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const from = (page - 1) * PAGE_SIZE;

  let query = sb.from('qt_quotations')
    .select('id, quote_number, revision, status, quote_date, valid_until, grand_total, blended_margin_pct, entity:qt_entities(code), customer:qt_customers(company_name, company_name_en, company_name_ar)', { count: 'exact' })
    .is('deleted_at', null);
  if (status) query = query.eq('status', status);
  if (q) query = query.ilike('quote_number', `%${q.replace(/[%,()]/g, '')}%`);
  query = query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ rows: data || [], total: count || 0, page, pageSize: PAGE_SIZE });
}

/* Create a draft quotation: body { entity_id, customer_id? } */
export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.entity_id) return json({ error: 'entity_id is required' }, 400);

  const { data: entity } = await sb.from('qt_entities').select('id, default_vat_rate').eq('id', body.entity_id).single();
  if (!entity) return json({ error: 'Unknown entity' }, 400);
  const defaults = await getSetting(sb, 'defaults', { validity_days: 7, vat_rate: 15 });

  const { data: num, error: numErr } = await sb.rpc('qt_next_quote_number', { p_entity: body.entity_id });
  if (numErr) return json({ error: numErr.message }, 500);

  const validUntil = new Date(Date.now() + (Number(defaults.validity_days) || 7) * 86400000).toISOString().slice(0, 10);
  const { data: terms } = await sb.from('qt_terms_templates')
    .select('id').eq('entity_id', body.entity_id).eq('is_default', true).is('deleted_at', null).maybeSingle();

  const row = {
    entity_id: body.entity_id,
    quote_number: num,
    customer_id: body.customer_id || null,
    salesperson_id: session.sub,
    status: 'draft',
    valid_until: validUntil,
    vat_rate: Number(entity.default_vat_rate) || Number(defaults.vat_rate) || 15,
    terms_template_id: terms ? terms.id : null,
    created_by: session.sub, updated_by: session.sub,
  };
  const { data, error } = await sb.from('qt_quotations').insert(row).select('id').single();
  if (error) return json({ error: error.message }, 500);
  await sb.from('qt_quotations').update({ root_id: data.id }).eq('id', data.id);
  await logEvent(sb, data.id, 'created', {}, session.sub);
  await audit(sb, 'qt_quotations', data.id, 'insert', null, { quote_number: num }, session.sub);
  return json({ id: data.id, quote_number: num }, 201);
}
