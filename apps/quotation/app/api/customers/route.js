'use strict';

/* Customers now live in the shared public.customers table (also used by
   apps/projects) instead of the old qt_customers — see
   supabase/apps-schema-v9-shared-customers.sql. This route translates
   between the UI's field names (phone) and the shared table's column
   names (mobile_number); everything else about the API response shape
   is unchanged so the customers page needs no UI changes. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit, applyBilingual } = require('@/lib/crud');
const { translate, hasArabic } = require('@/lib/translate');

const PAGE_SIZE = 25;
const UI_FIELDS = ['code', 'company_name', 'company_name_en', 'company_name_ar',
  'contact_person', 'contact_person_en', 'contact_person_ar', 'phone', 'phone2',
  'email', 'address', 'city', 'customer_type', 'vat_number', 'cr_number', 'notes', 'status'];

function toDbRow(body) {
  const out = {};
  for (const f of UI_FIELDS) {
    if (body[f] === undefined) continue;
    const col = f === 'phone' ? 'mobile_number' : f;
    out[col] = body[f] === '' ? null : body[f];
  }
  return out;
}
function fromDbRow(row) {
  if (!row) return row;
  const { mobile_number, ...rest } = row;
  return { ...rest, phone: mobile_number };
}

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const type = url.searchParams.get('type');
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const from = (page - 1) * PAGE_SIZE;

  let query = sb.from('customers').select('*', { count: 'exact' }).is('deleted_at', null);
  if (q) {
    const clean = String(q).replace(/[%,()]/g, '').trim();
    const alt = translate(clean, hasArabic(clean) ? 'en' : 'ar');
    const terms = [...new Set([clean, alt])].filter(Boolean);
    query = query.or(['company_name', 'company_name_en', 'company_name_ar', 'contact_person', 'mobile_number']
      .flatMap(c => terms.map(t => `${c}.ilike.%${t}%`)).join(','));
  }
  if (type) query = query.eq('customer_type', type);
  query = query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) return json({ error: error.message }, 500);
  return json({ rows: (data || []).map(fromDbRow), total: count || 0, page, pageSize: PAGE_SIZE });
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  let row = toDbRow(body);
  row = applyBilingual(row, ['company_name', 'contact_person'], null);
  if (!row.company_name || !String(row.company_name).trim()) return json({ error: '"company_name" is required.' }, 400);
  row.full_name = row.company_name;
  row.created_by = session.sub;
  row.updated_by = session.sub;
  const { data, error } = await sb.from('customers').insert(row).select().single();
  if (error) return json({ error: error.message }, 400);
  await audit(sb, 'customers', data.id, 'insert', null, data, session.sub);
  return json({ row: fromDbRow(data) }, 201);
}
