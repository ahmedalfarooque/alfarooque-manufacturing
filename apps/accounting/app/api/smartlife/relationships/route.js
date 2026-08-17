'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { normalizeSmartErpFinancialRecord } = require('../../../../../shared/financialRecords');

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const url = new URL(req.url);
  const externalId = url.searchParams.get('external_id');
  const recordType = url.searchParams.get('record_type') || 'sales_invoice';
  const sb = getDb();
  const [projects, integration] = await Promise.all([
    sb.from('pm_projects').select('id,project_name,customer_name,status').order('project_name'),
    sb.from('crm_integrations').select('last_sync_at,status,last_error').eq('tenant_id','alfarooque').eq('integration_key','smartlife').maybeSingle(),
  ]);
  let sourceRecord = null;
  let connection = null;
  let payments = [];
  if (externalId) {
    const source = await sb.from('erp_financial_source_records').select('*').eq('tenant_id','alfarooque').eq('source_system','smartlife').eq('record_type',recordType).eq('external_id',externalId).maybeSingle();
    sourceRecord = source.data || null;
    if (sourceRecord) {
      const [linked, paid] = await Promise.all([
        sb.from('erp_financial_connections').select('*').eq('source_record_id',sourceRecord.id).maybeSingle(),
        sb.from('erp_project_payments').select('*').eq('source_record_id',sourceRecord.id).order('payment_date', { ascending: false }),
      ]);
      connection = linked.data || null;
      payments = paid.data || [];
    }
  }
  return json({ projects: projects.data || [], sourceRecord, connection, payments, integration: integration.data || null });
}

export async function POST(req) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const body = await req.json().catch(() => ({}));
  if (body.action !== 'connect-project') return json({ error: 'Unsupported local relationship action.' }, 400);
  if (!body.project_id || !body.source_record) return json({ error: 'Project and SmartERP source record are required.' }, 400);
  const row = normalizeSmartErpFinancialRecord(body.resource || 'sales-invoices', body.source_record);
  if (!row) return json({ error: 'This SmartERP resource is not available for ERP connection.' }, 400);
  const sb = getDb();
  const { data: project } = await sb.from('pm_projects').select('id,project_name').eq('id',body.project_id).maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);
  const { data: sourceRecord, error: sourceError } = await sb.from('erp_financial_source_records').upsert(row, {
    onConflict: 'tenant_id,source_system,record_type,external_id', ignoreDuplicates: false,
  }).select().single();
  if (sourceError) return json({ error: 'Could not preserve the SmartERP source snapshot.' }, 500);
  const relationship = { tenant_id:'alfarooque', source_record_id:sourceRecord.id, project_id:project.id, workflow_status:'connected', created_by:session.sub, updated_at:new Date().toISOString() };
  const { data: connection, error } = await sb.from('erp_financial_connections').upsert(relationship, { onConflict:'tenant_id,source_record_id', ignoreDuplicates:false }).select().single();
  if (error) return json({ error: 'Could not connect the invoice to the project.' }, 500);
  const { data: integration } = await sb.from('crm_integrations').select('id').eq('tenant_id','alfarooque').eq('integration_key','smartlife').maybeSingle();
  await sb.from('crm_integration_audit_logs').insert({ integration_id:integration?.id || null, actor_id:session.sub, action:'smarterp.local_relationship_connected', entity_type:row.record_type, entity_id:row.external_id, details:{ project_id:project.id, source_unchanged:true } });
  return json({ connection, project, sourceRecord });
}
