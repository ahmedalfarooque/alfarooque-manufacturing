'use strict';

/* Canonical local snapshot for SmartLife account balances
   (accounting/account_balances) — additive, minimal table, upsert-by-
   source-id, same pattern as apps/shared/financialRecords.js but kept
   separate since the real data shape (id/account_number/account_name/
   balance only) does not fit that invoice-shaped table. */

function first(record, keys) {
  for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  return null;
}

function normalizeAccountBalance(record) {
  if (!record || typeof record !== 'object') return null;
  const externalId = first(record, ['id']);
  if (externalId == null) return null;
  const raw = JSON.parse(JSON.stringify(record));
  return {
    tenant_id: 'alfarooque', source_system: 'smartlife', external_id: String(externalId),
    account_number: String(first(record, ['account_number']) || ''),
    account_name: String(first(record, ['account_name']) || ''),
    balance: Number(first(record, ['balance'])) || 0,
    raw_payload: raw,
    last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
}

async function upsertSmartErpAccountBalances(sb, records) {
  const rows = (records || []).map(normalizeAccountBalance).filter(Boolean);
  for (let offset = 0; offset < rows.length; offset += 500) {
    const { error } = await sb.from('erp_smartlife_account_balances').upsert(rows.slice(offset, offset + 500), {
      onConflict: 'tenant_id,source_system,external_id', ignoreDuplicates: false,
    });
    if (error) throw error;
  }
  return rows.length;
}

module.exports = { normalizeAccountBalance, upsertSmartErpAccountBalances };
