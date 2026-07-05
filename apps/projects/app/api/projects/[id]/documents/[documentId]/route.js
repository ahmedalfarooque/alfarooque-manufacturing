'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const BUCKET = 'project-documents';

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: doc } = await sb.from('pm_project_documents').select('*').eq('id', params.documentId).eq('project_id', params.id).maybeSingle();
  if (!doc) return json({ error: 'Document not found.' }, 404);

  await sb.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
  const { error } = await sb.from('pm_project_documents').delete().eq('id', params.documentId);
  if (error) { console.error('[project documents] delete failed:', error.message); return json({ error: 'Could not delete the file.' }, 500); }
  return json({ ok: true });
}
