'use strict';

/* Imports the "WW-03 Customer Details.xlsx" format:
   columns  # | Company Name | Customer Name | Contact Number
   (title rows above the header are skipped automatically).
   Dedupes on normalised phone number. Admin only. */

const ExcelJS = require('exceljs');
const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');

export const runtime = 'nodejs';

function cellText(row, i) {
  const v = row.getCell(i).value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.richText) return v.richText.map(r => r.text).join('');
  if (typeof v === 'object' && v.text) return String(v.text);
  return String(v).trim();
}
function normPhone(s) {
  const d = String(s || '').replace(/\D/g, '');
  if (!d) return '';
  return d.replace(/^966/, '0').replace(/^00/, '0');
}
function looksLikePhone(s) { return /^0?\d{8,10}$/.test(String(s || '').replace(/\D/g, '')); }
function guessType(name) {
  const n = String(name || '');
  if (n.includes('فندق')) return 'hotel';
  if (n.includes('شركة') || n.includes('شركه') || n.includes('مؤسسة') || n.includes('مؤسسه')) return 'contractor';
  if (n.includes('مهندس')) return 'engineer';
  return 'other';
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;

  let buf;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
    buf = Buffer.from(await file.arrayBuffer());
  } catch (e) { return json({ error: 'Could not read upload: ' + e.message }, 400); }

  const wb = new ExcelJS.Workbook();
  try { await wb.xlsx.load(buf); } catch (e) { return json({ error: 'Not a valid .xlsx file.' }, 400); }
  const ws = wb.worksheets[0];
  if (!ws) return json({ error: 'Workbook has no sheets.' }, 400);

  const sb = getDb();
  const { data: existing } = await sb.from('customers').select('mobile_number').is('deleted_at', null);
  const seenPhones = new Set((existing || []).map(r => normPhone(r.mobile_number)).filter(Boolean));

  let headerPassed = false;
  const toInsert = [];
  let skippedDup = 0, skippedEmpty = 0;

  ws.eachRow((row) => {
    const c1 = cellText(row, 1), c2 = cellText(row, 2), c3 = cellText(row, 3), c4 = cellText(row, 4);
    if (!headerPassed) {
      if (/company\s*name/i.test(c2) || /company\s*name/i.test(c1)) headerPassed = true;
      return;
    }
    /* Cells can be shifted when company name is missing — take the last
       phone-looking cell as the number, first non-numeric text as name. */
    const cells = [c2, c3, c4].filter(Boolean);
    if (!cells.length) { skippedEmpty++; return; }
    let phone = '';
    for (let i = cells.length - 1; i >= 0; i--) {
      if (looksLikePhone(cells[i])) { phone = normPhone(cells[i]); cells.splice(i, 1); break; }
    }
    const company = cells[0] || '';
    const contact = cells[1] || '';
    if (!company && !contact && !phone) { skippedEmpty++; return; }
    if (phone && seenPhones.has(phone)) { skippedDup++; return; }
    if (phone) seenPhones.add(phone);
    const name = company || contact || null;
    toInsert.push({
      full_name: name,
      company_name: name,
      contact_person: contact || null,
      mobile_number: phone || null,
      customer_type: guessType(company || contact),
      city: 'Jeddah',
      status: 'active',
      notes: 'Imported from WW-03 Customer Details',
      created_by: session.sub, updated_by: session.sub,
    });
  });

  let inserted = 0;
  for (let i = 0; i < toInsert.length; i += 200) {
    const chunk = toInsert.slice(i, i + 200);
    const { error } = await sb.from('customers').insert(chunk);
    if (error) return json({ error: error.message, inserted }, 500);
    inserted += chunk.length;
  }

  await audit(sb, 'customers', null, 'insert', null,
    { import: 'customers', inserted, duplicates: skippedDup, empty: skippedEmpty }, session.sub);
  return json({ inserted, duplicates: skippedDup, empty: skippedEmpty });
}
