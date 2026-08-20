'use strict';

/* ═══════════════════════════════════════════════════════════════════════
   SmartERP JOURNAL / GENERAL LEDGER SYNC
   ═══════════════════════════════════════════════════════════════════════

   Source: accounting/get_entry/{id} — a real, already-authorized SmartERP V3
   read endpoint (see SMARTLIFE_DETAIL_RESOURCES.accounts in
   integrationPlatform.js). It was previously assumed unusable because it
   takes a single numeric id and SmartERP publishes no "list entries"
   endpoint. Verified live against the real company: entry ids are DENSE
   SEQUENTIAL INTEGERS, so the ledger IS enumerable by walking ids — no
   scraping, no undocumented path, no fabricated data.

   Verified response shape (real example, entry 10202):
     { id, related_id, date, description, confirm_by, created_by,
       modified_by, date_time, number, type, branch_id, year, branch_name,
       editable, none_editable_note, reference_number,
       details: [ { account_id, type: 'debit' | 'credite', value,
                    branch_id, account_num, name, cost_center_id,
                    cost_center_name, cost_center_number, statement } ],
       files: [] }

   Note `'credite'` — SmartERP's own spelling for the credit side. Both
   spellings are normalized to 'credit' here; nothing else is transformed.

   Verified entry `type` vocabulary (real values observed in this company's
   ledger): sales, purchases, return_sales, return_purchases, receipt,
   catch_receipt, manual, transfers, stock_supply_orders,
   stock_exchange_orders.
   'catch_receipt' is SmartERP's key for a CASH receipt.

   Ids that return an empty payload (deleted/never-used) are skipped, never
   invented — a gap in the id sequence is simply absent from the ledger. */

const { readSmartLifeDetail } = require('./integrationPlatform');

const TENANT_ID = 'alfarooque';
const SOURCE_SYSTEM = 'smartlife';

/* One entry by id.
     - returns the entry when SmartERP has one
     - returns null ONLY when SmartERP genuinely has no entry at that id
     - THROWS on any transport/auth/server failure

   That distinction is critical and was a real bug when it was missing: a
   transient failure swallowed as "no entry here" makes the ledger silently
   skip real money and, worse, can look like the end of the id sequence and
   stop the walk early (observed live — a concurrent backfill lost every
   entry past id ~1618 while those ids read back fine one at a time).

   SmartERP signals "no such entry" as HTTP 200 with no parseable body,
   which readSmartLifeDetail surfaces as an error carrying status 200 —
   that, and only that, is treated as a genuine gap. */
async function readJournalEntry(sb, id) {
  let result;
  try {
    result = await readSmartLifeDetail(sb, 'accounts', String(id));
  } catch (error) {
    if (error?.status === 200) return null;
    throw error;
  }
  const data = result?.providerPayload?.data;
  if (!data || typeof data !== 'object' || !data.id) return null;
  return data;
}

/* Read one id, retrying only genuine failures. A gap returns null on the
   first look; a failure is retried and, if it still fails, rethrown so the
   caller aborts instead of recording a false gap. */
const ID_RETRY_DELAYS_MS = [300, 900, 2500];
async function readJournalEntryWithRetry(sb, id) {
  let lastError;
  for (let attempt = 0; attempt <= ID_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await readJournalEntry(sb, id);
    } catch (error) {
      lastError = error;
      if (attempt === ID_RETRY_DELAYS_MS.length) break;
      await new Promise(resolve => setTimeout(resolve, ID_RETRY_DELAYS_MS[attempt]));
    }
  }
  throw lastError;
}

function normalizeSide(rawSide) {
  const side = String(rawSide || '').trim().toLowerCase();
  if (side.startsWith('deb')) return 'debit';
  if (side.startsWith('cred')) return 'credit';
  return side || 'unknown';
}

function textOrNull(value) {
  const text = value == null ? '' : String(value).trim();
  return text === '' ? null : text;
}

/* SmartERP dates arrive as 'YYYY-MM-DD' and 'YYYY-MM-DD HH:MM:SS' (server
   local time, no zone marker). The date column keeps the plain calendar
   date exactly as reported; the timestamp column only gets a value when
   SmartERP actually supplied a time component. Never invent a time. */
function normalizeEntry(entry) {
  const entryId = textOrNull(entry?.id);
  if (!entryId) return null;
  const date = textOrNull(entry?.date);
  const dateTime = textOrNull(entry?.date_time);
  return {
    tenant_id: TENANT_ID,
    source_system: SOURCE_SYSTEM,
    entry_id: entryId,
    entry_number: textOrNull(entry?.number),
    entry_date: date ? date.slice(0, 10) : null,
    entry_datetime: dateTime && /\d{2}:\d{2}/.test(dateTime) ? dateTime.replace(' ', 'T') + 'Z' : null,
    entry_type: textOrNull(entry?.type),
    description: textOrNull(entry?.description),
    reference_number: textOrNull(entry?.reference_number),
    branch_id: textOrNull(entry?.branch_id),
    branch_name: textOrNull(entry?.branch_name),
    fiscal_year: textOrNull(entry?.year),
    related_id: textOrNull(entry?.related_id),
    raw_payload: entry,
    last_synced_at: new Date().toISOString(),
  };
}

function normalizeLines(entry) {
  const entryId = textOrNull(entry?.id);
  if (!entryId) return [];
  const details = Array.isArray(entry?.details) ? entry.details : [];
  return details.map((line, index) => ({
    tenant_id: TENANT_ID,
    source_system: SOURCE_SYSTEM,
    entry_id: entryId,
    line_index: index,
    side: normalizeSide(line?.type),
    value: Number(line?.value) || 0,
    account_id: textOrNull(line?.account_id),
    account_number: textOrNull(line?.account_num),
    account_name: textOrNull(line?.name),
    cost_center_id: textOrNull(line?.cost_center_id),
    cost_center_name: textOrNull(line?.cost_center_name),
    cost_center_number: textOrNull(line?.cost_center_number),
    statement: textOrNull(line?.statement),
    branch_id: textOrNull(line?.branch_id),
  }));
}

async function upsertEntries(sb, entries) {
  const headers = entries.map(normalizeEntry).filter(Boolean);
  if (!headers.length) return 0;
  for (let offset = 0; offset < headers.length; offset += 200) {
    const { error } = await sb.from('erp_smartlife_journal_entries').upsert(headers.slice(offset, offset + 200), {
      onConflict: 'tenant_id,source_system,entry_id', ignoreDuplicates: false,
    });
    if (error) throw error;
  }
  const lines = entries.flatMap(normalizeLines);
  for (let offset = 0; offset < lines.length; offset += 500) {
    const { error } = await sb.from('erp_smartlife_journal_lines').upsert(lines.slice(offset, offset + 500), {
      onConflict: 'tenant_id,source_system,entry_id,line_index', ignoreDuplicates: false,
    });
    if (error) throw error;
  }
  return headers.length;
}

async function highestSyncedEntryId(sb) {
  const { data, error } = await sb.from('erp_smartlife_journal_entries')
    .select('entry_id')
    .eq('tenant_id', TENANT_ID).eq('source_system', SOURCE_SYSTEM);
  if (error) throw error;
  let highest = 0;
  for (const row of data || []) {
    const value = Number(row.entry_id);
    if (Number.isFinite(value) && value > highest) highest = value;
  }
  return highest;
}

/* Walk a bounded window of ids concurrently, returning both the entries
   found AND the ids SmartERP genuinely has no entry for — the caller needs
   the real gap count to detect the end of the ledger, and it must never be
   inflated by failures. A hard failure propagates: better to abort a sync
   run and report it than to write a ledger with holes in it.

   Concurrency is deliberately low: this hits the vendor's production API,
   and a higher fan-out is what triggered the transient failures in the
   first place. */
async function fetchIdWindow(sb, ids, concurrency = 4) {
  const found = [];
  let gaps = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < ids.length) {
      const id = ids[cursor];
      cursor += 1;
      const entry = await readJournalEntryWithRetry(sb, id);
      if (entry) found.push(entry); else gaps += 1;
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return { found, gaps };
}

/* Incremental sync. Walks forward from the highest id already stored until
   MISS_STREAK consecutive ids come back empty, which is how the end of the
   ledger is detected (SmartERP exposes no count). `recheckRecent` re-reads
   the newest already-stored ids so an edited entry is refreshed rather than
   left stale — entries carry `editable`, so late edits are real.
     - maxEntries bounds a single run so a sync can never run unbounded.
     - Returns counts only; never throws for a single missing id. */
const MISS_STREAK = 60;
async function syncJournalEntries(sb, { maxEntries = 400, recheckRecent = 40, concurrency = 4, fromId = null, maxId = null } = {}) {
  const highest = fromId != null ? Number(fromId) : await highestSyncedEntryId(sb);
  const start = Math.max(1, highest - (fromId != null ? 0 : recheckRecent) + 1);
  let cursor = start;
  let consecutiveGaps = 0;
  let written = 0;
  let totalGaps = 0;
  const batchSize = Math.max(concurrency, 20);
  while (written < maxEntries && consecutiveGaps < MISS_STREAK) {
    if (maxId != null && cursor > Number(maxId)) break;
    const ids = [];
    for (let i = 0; i < batchSize; i += 1) {
      const id = cursor + i;
      if (maxId != null && id > Number(maxId)) break;
      ids.push(id);
    }
    if (!ids.length) break;
    cursor += ids.length;
    const { found, gaps } = await fetchIdWindow(sb, ids, concurrency);
    totalGaps += gaps;
    if (found.length) {
      written += await upsertEntries(sb, found);
      /* Any real entry in the window proves the ledger continues, so the
         end-of-ledger streak resets. */
      consecutiveGaps = 0;
    } else {
      consecutiveGaps += gaps;
    }
  }
  return { written, gaps: totalGaps, lastIdProbed: cursor - 1, startedFrom: start };
}

module.exports = {
  readJournalEntry, readJournalEntryWithRetry, syncJournalEntries, upsertEntries, highestSyncedEntryId,
  __testables: { normalizeEntry, normalizeLines, normalizeSide, fetchIdWindow },
};
