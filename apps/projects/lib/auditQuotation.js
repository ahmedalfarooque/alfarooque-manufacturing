'use strict';

/* Writes into apps/quotation's own qt_audit_logs table — same Postgres
   instance, so this app can log directly into it rather than inventing
   a second audit table for just the cross-app actions (Part 15). Only
   used for the quotation-request review/start-project actions Projects
   performs on quotation data; every other pm_* action keeps using
   pm_project_logs as before. */

const { currentIp } = require('./requestContext');

async function auditQuotation(sb, table, recordId, action, oldData, newData, actorId) {
  try {
    await sb.from('qt_audit_logs').insert({
      table_name: table, record_id: recordId, action,
      old_data: oldData || null, new_data: newData || null, actor_id: actorId,
      ip: currentIp(),
    });
  } catch (_) {}
}

module.exports = { auditQuotation };
