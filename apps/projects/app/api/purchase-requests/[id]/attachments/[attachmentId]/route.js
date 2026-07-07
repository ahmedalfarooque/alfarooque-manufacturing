'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

const BUCKET = 'project-documents';
const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  pdf: 'application/pdf', xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
};

export async function GET(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: doc } = await sb.from('pm_purchase_request_attachments').select('*').eq('id', params.attachmentId).eq('purchase_request_id', params.id).maybeSingle();
  if (!doc) return json({ error: 'Attachment not found.' }, 404);

  const { data: pr } = await sb.from('pm_purchase_requests').select('project_id').eq('id', params.id).maybeSingle();
  if (!pr || !(await isAssignedOrAdmin(session, pr.project_id))) return json({ error: 'You do not have access to this attachment.' }, 403);

  const { data: blob, error } = await sb.storage.from(BUCKET).download(doc.storage_path);
  if (error || !blob) { console.error('[pr attachments] download failed:', error?.message); return json({ error: 'Could not load the file.' }, 500); }

  const buf = Buffer.from(await blob.arrayBuffer());
  const ext = (doc.file_name.split('.').pop() || '').toLowerCase();
  const contentType = blob.type || MIME_BY_EXT[ext] || 'application/octet-stream';
  return new Response(buf, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(doc.file_name)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}

export async function DELETE(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  const sb = getDb();
  const { data: doc } = await sb.from('pm_purchase_request_attachments').select('*').eq('id', params.attachmentId).eq('purchase_request_id', params.id).maybeSingle();
  if (!doc) return json({ error: 'Attachment not found.' }, 404);

  await sb.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
  const { error } = await sb.from('pm_purchase_request_attachments').delete().eq('id', params.attachmentId);
  if (error) { console.error('[pr attachments] delete failed:', error.message); return json({ error: 'Could not delete the file.' }, 500); }
  return json({ ok: true });
}
