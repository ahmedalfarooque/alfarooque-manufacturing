'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

for (const line of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const text = line.trim();
  if (!text || text.startsWith('#')) continue;
  const split = text.indexOf('=');
  if (split < 1) continue;
  const key = text.slice(0, split).trim();
  let value = text.slice(split + 1).trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  if (!(key in process.env)) process.env[key] = value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createDraft(client, entityId, suffix) {
  const { rows } = await client.query(
    `insert into public.qt_quotations (entity_id, quote_number, status, grand_total)
     values ($1, $2, 'draft', 1150) returning id`,
    [entityId, `TEST-QA-${suffix}-${Date.now()}`],
  );
  return rows[0].id;
}

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query('begin');
  try {
    const entity = (await client.query('select id from public.qt_entities where is_active = true limit 1')).rows[0];
    const actor = (await client.query("select id from public.platform_users where role = 'admin' and is_active = true limit 1")).rows[0];
    assert(entity && actor, 'An active entity and admin are required for the rollback-only workflow test.');

    const approvedQuoteId = await createDraft(client, entity.id, 'APPROVE');
    const first = (await client.query('select x.* from public.qt_submit_for_quotation_approval($1,$2) x', [approvedQuoteId, actor.id])).rows[0];
    const second = (await client.query('select x.* from public.qt_submit_for_quotation_approval($1,$2) x', [approvedQuoteId, actor.id])).rows[0];
    assert(first.id === second.id, 'Duplicate submission created a second approval request.');
    const activeCount = Number((await client.query("select count(*) from public.project_requests where quotation_id=$1 and status <> 'rejected'", [approvedQuoteId])).rows[0].count);
    assert(activeCount === 1, 'Quotation has more than one active approval request.');
    const waiting = (await client.query('select status, project_request_id from public.qt_quotations where id=$1', [approvedQuoteId])).rows[0];
    assert(waiting.status === 'waiting_quotation_approval' && waiting.project_request_id === first.id, 'Submission did not atomically link the waiting quotation.');

    await client.query("select x.* from public.qt_decide_quotation_approval($1,'approved',null,$2) x", [first.id, actor.id]);
    const approved = (await client.query('select status, project_status from public.qt_quotations where id=$1', [approvedQuoteId])).rows[0];
    assert(approved.status === 'quotation_approved' && approved.project_status === 'approved', 'Approval did not synchronize both records.');

    const rejectedQuoteId = await createDraft(client, entity.id, 'REJECT');
    const rejectedRequest = (await client.query('select x.* from public.qt_submit_for_quotation_approval($1,$2) x', [rejectedQuoteId, actor.id])).rows[0];
    await client.query("select x.* from public.qt_decide_quotation_approval($1,'rejected','Safe test rejection',$2) x", [rejectedRequest.id, actor.id]);
    const rejected = (await client.query('select status, project_status, project_id from public.qt_quotations where id=$1', [rejectedQuoteId])).rows[0];
    assert(rejected.status === 'quotation_rejected' && rejected.project_status === 'rejected' && !rejected.project_id, 'Rejection did not stop before customer/project stages.');

    console.log('✓ Duplicate submit returned one active request.');
    console.log('✓ Approval atomically synchronized request and quotation.');
    console.log('✓ Rejection synchronized and created no project.');
    console.log('✓ All safe test records will be rolled back.');
  } finally {
    await client.query('rollback');
    await client.end();
  }
}

main().catch(error => { console.error('✗ ' + error.message); process.exit(1); });
