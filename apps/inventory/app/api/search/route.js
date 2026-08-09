'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

export async function GET(req) {
  const { response } = requireSession(req);
  if (response) return response;

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ products: [], materials: [], suppliers: [] });

  const sb = getDb();
  const [{ data: products }, { data: materials }, { data: suppliers }] = await Promise.all([
    sb.from('inv_products').select('id, name, sku, qty_on_hand')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,sku.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(6),
    sb.from('inv_materials').select('id, name, material_code, qty_on_hand')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,material_code.ilike.%${q}%,description.ilike.%${q}%`)
      .limit(6),
    sb.from('inv_suppliers').select('id, name, email, phone, city')
      .eq('is_active', true)
      .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(6),
  ]);

  return json({ products: products || [], materials: materials || [], suppliers: suppliers || [] });
}
