'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const BUCKET = 'maintenance-documents';

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: attachment } = await sb.from('car_maintenance_attachments').select('*').eq('id', params.attachmentId).eq('record_id', params.id).maybeSingle();
  if (!attachment) return json({ error: 'Attachment not found.' }, 404);

  await sb.storage.from(BUCKET).remove([attachment.storage_path]).catch(() => {});
  const { error } = await sb.from('car_maintenance_attachments').delete().eq('id', params.attachmentId);
  if (error) { console.error('[maintenance attachment] delete failed:', error.message); return json({ error: 'Could not delete attachment.' }, 500); }
  return json({ ok: true });
}
