'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const sb = getDb();
  const { data, error } = await sb.from('qt_entities')
    .select('id, code, name_en, name_ar, quote_prefix, default_vat_rate, phone, cr_number')
    .eq('is_active', true).order('code');
  if (error) return json({ error: error.message }, 500);
  return json({ rows: data || [] });
}
