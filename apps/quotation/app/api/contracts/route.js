'use strict';

/* Contracts collection endpoint.
   GET  ?q=&status=&page=  → paginated list (any authenticated user)
   POST { quotationId?, templateKey?, outputLang? } → create + return id
          (write permission required). Numbering + template seeding +
          quotation forwarding are handled in lib/contracts/repo.js. */

const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');
const repo = require('@/lib/contracts/repo');

export async function GET(req) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const url = new URL(req.url);
  try {
    const result = await repo.listContracts({
      q: url.searchParams.get('q') || '',
      status: url.searchParams.get('status') || '',
      page: Math.max(1, parseInt(url.searchParams.get('page') || '1', 10)),
    });
    return json(result);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function POST(req) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const body = await req.json().catch(() => ({}));
  try {
    const created = await repo.createContract({
      quotationId: body.quotationId || null,
      templateKey: body.templateKey || 'general',
      outputLang: ['en', 'ar', 'both'].includes(body.outputLang) ? body.outputLang : 'both',
      userId: session.sub,
    });
    await audit(require('@/lib/db').getDb(), 'qt_contracts', created.id, 'create',
      null, { contract_number: created.contract_number, from_quotation: body.quotationId || null }, session.sub);
    return json(created, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
