'use strict';

/* Supabase persistence for the expiry-alert system. Server-only (uses the
   service-role client). Mirrors the store interface the engine expects —
   the in-memory twin lives in lib/alertEngine.test.js. */

const { getDb } = require('./db');

const STALE_PENDING_MS = 15 * 60 * 1000;
const TYPES = ['insurance', 'inspection'];

/* PostgREST / Postgres signals for "migration v13 has not been applied". */
function isSchemaMissing(err) {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || '');
  return code === '42P01' || code === '42703' || code === 'PGRST205' || code === 'PGRST204' ||
    /could not find the (table|'[^']+' column)/i.test(msg) || /does not exist/i.test(msg);
}

function fail(error, what) {
  const e = new Error(isSchemaMissing(error) ? 'Expiry-alert tables are not installed (apply supabase/apps-schema-v13-cars-expiry-alerts.sql).' : `Could not ${what}.`);
  e.code = isSchemaMissing(error) ? 'SCHEMA_MISSING' : 'DB_ERROR';
  e.cause = error;
  return e;
}

const DEFAULT_TYPE_SETTINGS = { enabled: true, auto_notify_enabled: true, email_language: 'en' };

function createSupabaseStore(sb = getDb()) {
  return {
    /* { insurance: {...}, inspection: {...} } — defaults for a missing row. */
    async getSettings() {
      const { data, error } = await sb.from('car_alert_type_settings').select('*');
      if (error) throw fail(error, 'load alert settings');
      const out = {};
      for (const t of TYPES) out[t] = { alert_type: t, ...DEFAULT_TYPE_SETTINGS, ...((data || []).find(r => r.alert_type === t) || {}) };
      return out;
    },
    async saveSettings(alertType, patch, updatedBy) {
      const { data, error } = await sb.from('car_alert_type_settings')
        .upsert({ alert_type: alertType, ...patch, updated_by: updatedBy || null, updated_at: new Date().toISOString() }, { onConflict: 'alert_type' })
        .select().single();
      if (error) throw fail(error, 'save alert settings');
      return data;
    },
    async listRecipients() {
      const { data, error } = await sb.from('car_alert_recipients').select('id, alert_type, email, name, enabled, created_at').order('created_at', { ascending: true });
      if (error) throw fail(error, 'load alert recipients');
      return data || [];
    },
    async listActiveAlertStates() {
      const { data, error } = await sb.from('car_expiry_alerts').select('*').eq('state', 'active');
      if (error) throw fail(error, 'load alert state');
      return data || [];
    },
    async findAlert(carId, type, date) {
      const { data, error } = await sb.from('car_expiry_alerts').select('*').eq('car_id', carId).eq('alert_type', type).eq('expiry_date', date).maybeSingle();
      if (error) throw fail(error, 'load alert state');
      return data;
    },
    async upsertActiveAlert({ car_id, alert_type, expiry_date, today }) {
      const existing = await this.findAlert(car_id, alert_type, expiry_date);
      if (existing) {
        if (existing.state === 'active') return existing;
        const { data, error } = await sb.from('car_expiry_alerts')
          .update({ state: 'active', resolved_on: null, resolved_reason: null, updated_at: new Date().toISOString() })
          .eq('id', existing.id).select().single();
        if (error) throw fail(error, 'reactivate alert');
        return data;
      }
      const { data, error } = await sb.from('car_expiry_alerts')
        .insert({ car_id, alert_type, expiry_date, first_detected_on: today }).select().single();
      if (error) {
        if (error.code === '23505') return this.findAlert(car_id, alert_type, expiry_date);
        throw fail(error, 'record alert');
      }
      return data;
    },
    async resolveAlert(id, today, reason) {
      const { error } = await sb.from('car_expiry_alerts')
        .update({ state: 'resolved', resolved_on: today, resolved_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', id).eq('state', 'active');
      if (error) throw fail(error, 'resolve alert');
    },
    /* Claim = the idempotency gate. Returns true only for the single
       caller allowed to send this (alert, recipient, day). */
    async claimDelivery({ alertId, recipient, day }) {
      const base = { alert_id: alertId, recipient, sent_on: day };
      const { data: existing, error: selErr } = await sb.from('car_expiry_alert_deliveries').select('id, status, updated_at').match(base).maybeSingle();
      if (selErr) throw fail(selErr, 'check delivery log');
      if (!existing) {
        const { error } = await sb.from('car_expiry_alert_deliveries').insert({ ...base, status: 'pending' });
        if (!error) return true;
        if (error.code === '23505') return false; // another run claimed it first
        throw fail(error, 'claim delivery');
      }
      const stale = existing.status === 'pending' && Date.now() - new Date(existing.updated_at).getTime() > STALE_PENDING_MS;
      const retryable = existing.status === 'failed' || stale;
      if (!retryable) return false;
      const { data: taken, error } = await sb.from('car_expiry_alert_deliveries')
        .update({ status: 'pending', error: null, updated_at: new Date().toISOString() })
        .eq('id', existing.id).eq('status', existing.status).eq('updated_at', existing.updated_at).select('id');
      if (error) throw fail(error, 'claim delivery');
      return Array.isArray(taken) && taken.length === 1;
    },
    async finishDelivery({ alertId, recipient, day, status, providerId, error }) {
      const { error: e } = await sb.from('car_expiry_alert_deliveries')
        .update({ status, provider_id: providerId || null, error: error || null, updated_at: new Date().toISOString() })
        .match({ alert_id: alertId, recipient, sent_on: day });
      if (e) throw fail(e, 'update delivery log');
    },
    async isDelivered(alertId, recipient, day) {
      const { data, error } = await sb.from('car_expiry_alert_deliveries').select('status').match({ alert_id: alertId, recipient, sent_on: day }).maybeSingle();
      if (error) throw fail(error, 'check delivery log');
      if (!data) return false;
      return data.status === 'sent';
    },
    async markSent(alertId, day) {
      const { error } = await sb.from('car_expiry_alerts').update({ last_sent_on: day, updated_at: new Date().toISOString() }).eq('id', alertId);
      if (error) throw fail(error, 'update alert');
    },
    /* Run log — only real (non-dry) runs. */
    async startRun({ trigger, today }) {
      const { data, error } = await sb.from('car_alert_job_runs').insert({ trigger, run_date: today }).select('id').single();
      if (error) throw fail(error, 'record job run');
      return data.id;
    },
    async finishRun(id, report, errorMessage) {
      const status = errorMessage ? 'failed' : report.emailsFailed > 0 ? 'partial' : 'ok';
      const { error } = await sb.from('car_alert_job_runs').update({
        finished_at: new Date().toISOString(), status,
        active_alerts: report.activeAlerts || 0, recipients: report.recipients || 0, emails_sent: report.emailsSent || 0,
        emails_failed: report.emailsFailed || 0, duplicates_skipped: report.duplicatesSkipped || 0,
        resolved: (report.resolved || []).length, error: errorMessage ? String(errorMessage).slice(0, 300) : null,
      }).eq('id', id);
      if (error) throw fail(error, 'record job run');
    },
    async lastRun() {
      const { data, error } = await sb.from('car_alert_job_runs').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw fail(error, 'load job runs');
      return data || null;
    },
    /* Test sends — separate from real deliveries. */
    async recordTestSend({ alertType, recipient, sentBy, status, providerId, error }) {
      const { error: e } = await sb.from('car_alert_test_sends').insert({ alert_type: alertType, recipient, sent_by: sentBy || null, status, provider_id: providerId || null, error: error || null });
      if (e) throw fail(e, 'record test send');
    },
    async lastTestSend(alertType) {
      const { data, error } = await sb.from('car_alert_test_sends').select('created_at, status, sent_by, provider_id, error').eq('alert_type', alertType).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) throw fail(error, 'load test sends');
      return data || null;
    },
  };
}

module.exports = { createSupabaseStore, isSchemaMissing, DEFAULT_TYPE_SETTINGS, TYPES };
