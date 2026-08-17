'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');

export async function POST(req, { params }) {
  const { response, session } = await requireAction(req, 'add');
  if (response) return response;
  const sb = getDb();
  const { data: contact, error } = await sb.from('crm_contacts').select('id,name,email,phone,company').eq('id', params.id).maybeSingle();
  if (error || !contact) return json({ error: 'Contact not found.' }, 404);
  const { data: identity, error: identityError } = await sb.from('crm_customer_identities').upsert({
    crm_contact_id: contact.id,
    display_name: contact.name,
    normalized_email: contact.email ? String(contact.email).trim().toLowerCase() : null,
    normalized_phone: contact.phone ? String(contact.phone).replace(/\D/g, '') : null,
    company_name: contact.company || null,
    created_by: session.sub,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'tenant_id,crm_contact_id' }).select().single();
  if (identityError) return json({ error: 'Could not initialize customer identity.' }, 500);
  const body = await req.json().catch(() => ({}));
  if (body.source_system && body.source_record_id && body.entity_type) {
    const { error: mappingError } = await sb.from('crm_record_mappings').upsert({
      customer_identity_id: identity.id,
      source_system: String(body.source_system),
      entity_type: String(body.entity_type),
      source_record_id: String(body.source_record_id),
      local_record_id: body.local_record_id ? String(body.local_record_id) : null,
      sync_status: 'mapped',
      last_synced_at: new Date().toISOString(),
    }, { onConflict: 'tenant_id,source_system,entity_type,source_record_id' });
    if (mappingError) return json({ error: 'Could not link source record.' }, 500);
  }
  return json({ identity });
}
