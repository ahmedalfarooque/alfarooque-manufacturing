'use strict';

/* Generic list/create/update/soft-delete handlers for qt_* master
   tables, shared by the simple CRUD API routes. Field whitelisting per
   table, search across configured columns, qt_audit_logs on every
   write. Reads need a session; writes go through requireWrite (role-
   aware: platform admin OR a quotation role with the 'write' perm). */

const { getDb } = require('./db');
const { json, requireSession, requireWrite } = require('./http');
const { translate, hasArabic } = require('./translate');
const { currentIp } = require('./requestContext');

const PAGE_SIZE = 25;

/* Single-language data model: records store ONE value; display-time
   translation happens in the UI (tr()). Search is bilingual — the query
   is also translated to the other language and both variants are
   OR-matched, so "Premium" and "باب" both find the same record.       */
function searchTerms(q) {
  const clean = (s) => String(s).replace(/[%,()]/g, '').trim();
  const alt = translate(q, hasArabic(q) ? 'en' : 'ar');
  return [...new Set([clean(q), clean(alt)])].filter(Boolean);
}

async function audit(sb, table, recordId, action, oldData, newData, actorId) {
  try {
    await sb.from('qt_audit_logs').insert({
      table_name: table, record_id: recordId, action,
      old_data: oldData || null, new_data: newData || null, actor_id: actorId,
      ip: currentIp(),
    });
  } catch (_) {}
}

function pick(body, fields) {
  const out = {};
  for (const f of fields) {
    if (body[f] === undefined) continue;
    out[f] = body[f] === '' ? null : body[f];
  }
  return out;
}

/* ═══ Stored-bilingual auto-fill (v6 model) ═══
   `bilingual: ['name', …]` on a route config makes every save keep the
   *_en / *_ar pair complete: whichever language the user typed fills its
   column, the missing one is dictionary-generated ONCE and stored
   permanently (never translated at render time). The canonical column
   stays = EN (fallback AR) so legacy code keeps working.              */
function applyBilingual(row, bases, before) {
  for (const base of bases || []) {
    const enCol = base + '_en', arCol = base + '_ar';
    const touched = row[base] !== undefined || row[enCol] !== undefined || row[arCol] !== undefined;
    if (!touched) continue;
    let en = row[enCol] !== undefined ? row[enCol] : (before ? before[enCol] : null);
    let ar = row[arCol] !== undefined ? row[arCol] : (before ? before[arCol] : null);
    const canonical = row[base] !== undefined ? row[base] : (before ? before[base] : null);
    /* seed from canonical if both empty (legacy single-field forms) */
    if (!en && !ar && canonical) {
      if (hasArabic(canonical)) ar = canonical; else en = canonical;
    }
    if (en && !ar) ar = translate(en, 'ar');
    if (ar && !en) en = translate(ar, 'en');
    if (en !== undefined) row[enCol] = en || null;
    if (ar !== undefined) row[arCol] = ar || null;
    row[base] = en || ar || canonical || null;
  }
  return row;
}

function makeListHandler({ table, searchCols, fields, defaultOrder, filters }) {
  return async function GET(req) {
    const { session, response } = requireSession(req);
    if (!session) return response;
    const sb = getDb();
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const from = (page - 1) * PAGE_SIZE;

    let query = sb.from(table).select('*', { count: 'exact' }).is('deleted_at', null);
    if (q) {
      const terms = searchTerms(q);
      query = query.or(searchCols.flatMap(c => terms.map(x => `${c}.ilike.%${x}%`)).join(','));
    }
    if (filters) query = filters(query, url.searchParams);
    query = query.order(defaultOrder || 'created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);

    const { data, count, error } = await query;
    if (error) return json({ error: error.message }, 500);
    return json({ rows: data || [], total: count || 0, page, pageSize: PAGE_SIZE });
  };
}

function makeCreateHandler({ table, fields, prepare, required, bilingual }) {
  return async function POST(req) {
    const { session, response } = await requireWrite(req);
    if (!session) return response;
    const sb = getDb();
    const body = await req.json().catch(() => ({}));
    let row = pick(body, fields);
    row = applyBilingual(row, bilingual, null);
    /* Only the fields in `required` are mandatory — everything else may
       be empty/NULL (spec: complete information later). */
    for (const f of required || []) {
      if (!row[f] || !String(row[f]).trim()) return json({ error: `"${f}" is required.` }, 400);
    }
    if (prepare) row = await prepare(row, { sb, session, body, isNew: true });
    row.created_by = session.sub;
    row.updated_by = session.sub;
    const { data, error } = await sb.from(table).insert(row).select().single();
    if (error) return json({ error: error.message }, 400);
    await audit(sb, table, data.id, 'insert', null, data, session.sub);
    return json({ row: data }, 201);
  };
}

/* Generic duplicate handler: clone a live row into a new record, minus
   identity/timestamp columns. `prepareCopy` lets callers regenerate a
   unique code/name for the clone (e.g. auto-numbering). */
function makeDuplicateHandler({ table, fields, prepareCopy }) {
  return async function POST(req, { params }) {
    const { session, response } = await requireWrite(req);
    if (!session) return response;
    const sb = getDb();
    const { data: src } = await sb.from(table).select('*').eq('id', params.id).is('deleted_at', null).single();
    if (!src) return json({ error: 'Not found' }, 404);

    let copy = pick(src, fields);
    if (prepareCopy) copy = await prepareCopy(copy, { sb, src });
    copy.created_by = session.sub;
    copy.updated_by = session.sub;

    const { data: created, error } = await sb.from(table).insert(copy).select().single();
    if (error) return json({ error: error.message }, 400);
    await audit(sb, table, created.id, 'insert', null, { duplicated_from: params.id, ...created }, session.sub);
    return json({ row: created }, 201);
  };
}

function makeItemHandlers({ table, fields, prepare, afterUpdate, required, bilingual }) {
  async function GET(req, { params }) {
    const { session, response } = requireSession(req);
    if (!session) return response;
    const sb = getDb();
    const { data, error } = await sb.from(table).select('*').eq('id', params.id).is('deleted_at', null).single();
    if (error || !data) return json({ error: 'Not found' }, 404);
    return json({ row: data });
  }

  async function PATCH(req, { params }) {
    const { session, response } = await requireWrite(req);
    if (!session) return response;
    const sb = getDb();
    const body = await req.json().catch(() => ({}));
    const { data: before } = await sb.from(table).select('*').eq('id', params.id).single();
    if (!before) return json({ error: 'Not found' }, 404);
    let patch = pick(body, fields);
    patch = applyBilingual(patch, bilingual, before);
    for (const f of required || []) {
      const eff = patch[f] !== undefined ? patch[f] : before[f];
      if (!eff || !String(eff).trim()) return json({ error: `"${f}" is required.` }, 400);
    }
    if (prepare) patch = await prepare(patch, { sb, session, body, isNew: false, before });
    patch.updated_by = session.sub;
    patch.updated_at = new Date().toISOString();
    const { data, error } = await sb.from(table).update(patch).eq('id', params.id).select().single();
    if (error) return json({ error: error.message }, 400);
    await audit(sb, table, params.id, 'update', before, data, session.sub);
    if (afterUpdate) await afterUpdate({ sb, session, before, after: data });
    return json({ row: data });
  }

  async function DELETE(req, { params }) {
    const { session, response } = await requireWrite(req);
    if (!session) return response;
    const sb = getDb();
    const { data: before } = await sb.from(table).select('*').eq('id', params.id).single();
    const { error } = await sb.from(table)
      .update({ deleted_at: new Date().toISOString(), updated_by: session.sub })
      .eq('id', params.id);
    if (error) return json({ error: error.message }, 400);
    await audit(sb, table, params.id, 'delete', before, null, session.sub);
    return json({ ok: true });
  }

  return { GET, PATCH, DELETE };
}

module.exports = { PAGE_SIZE, audit, pick, applyBilingual, makeListHandler, makeCreateHandler, makeItemHandlers, makeDuplicateHandler };
