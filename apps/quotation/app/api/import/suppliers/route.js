'use strict';

/* Supplier import (template from /api/export/suppliers?template=1).
   Upsert by Arabic name, else English name. */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const { parseUpload, col, toNum } = require('@/lib/sheets');
const { translate } = require('@/lib/translate');

export const runtime = 'nodejs';

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const parsed = await parseUpload(req);
  if (parsed.error) return json({ error: parsed.error }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('qt_suppliers').select('id, name').is('deleted_at', null);
  const byName = new Map((existing || []).flatMap(s =>
    [[(s.name || '').trim(), s.id]].filter(([k]) => k)));

  let inserted = 0, updated = 0, failed = 0;
  const errors = [];

  for (let i = 0; i < parsed.rows.length; i++) {
    const r = parsed.rows[i];
    const rowNo = i + 2;
    const nameIn = col(r, ['name', 'supplier name', 'arabic name', 'english name', 'name ar', 'name en', 'الاسم', 'اسم المورد']);

    if (!nameIn) { failed++; errors.push(`Row ${rowNo}: missing supplier name`); continue; }

    const row = {
      name: nameIn,

      contact_person: col(r, ['contact person', 'contact']) || null,
      phone: col(r, ['phone']) || null,
      email: col(r, ['email']) || null,
      address: col(r, ['address']) || null,
      country: col(r, ['country']) || 'Saudi Arabia',
      currency: (col(r, ['currency']) || 'SAR').toUpperCase().slice(0, 3),
      vat_number: col(r, ['vat no', 'vat number', 'vat']) || null,
      cr_number: col(r, ['cr no', 'cr number', 'cr']) || null,
      payment_terms: col(r, ['payment terms']) || null,
      bank_name: col(r, ['bank name', 'bank']) || null,
      iban: col(r, ['iban']) || null,
      rating: toNum(col(r, ['rating (1-5)', 'rating'])),
      notes: col(r, ['notes']) || null,
      status: 'active',
      updated_by: session.sub,
    };

    try {
      const key = nameIn.trim();
      if (byName.has(key)) {
        const { error } = await sb.from('qt_suppliers')
          .update({ ...row, updated_at: new Date().toISOString() }).eq('id', byName.get(key));
        if (error) throw error;
        updated++;
      } else {
        row.created_by = session.sub;
        const { data: ins, error } = await sb.from('qt_suppliers').insert(row).select('id').single();
        if (error) throw error;
        byName.set(key, ins.id);
        inserted++;
      }
    } catch (e) { failed++; errors.push(`Row ${rowNo}: ${e.message}`); }
  }

  await audit(sb, 'qt_suppliers', null, 'insert', null, { import: 'suppliers', inserted, updated, failed }, session.sub);
  return json({ inserted, updated, failed, errors: errors.slice(0, 50) });
}
