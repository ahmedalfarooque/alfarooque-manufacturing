'use strict';

/* GET streams the file's bytes through this server instead of handing
   the browser a raw supabase.co URL — some corporate networks/DNS
   filters block direct access to Supabase Storage's domain, which made
   uploaded images look "broken" even though the file itself was fine.
   Routing through our own domain sidesteps that entirely. */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const BUCKET = 'project-documents';

const MIME_BY_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', pdf: 'application/pdf',
};

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: doc } = await sb.from('pm_project_documents').select('*').eq('id', params.documentId).eq('project_id', params.id).maybeSingle();
  if (!doc) return json({ error: 'Document not found.' }, 404);

  const { data: blob, error } = await sb.storage.from(BUCKET).download(doc.storage_path);
  if (error || !blob) { console.error('[project documents] download failed:', error?.message); return json({ error: 'Could not load the file.' }, 500); }

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
  const { data: doc } = await sb.from('pm_project_documents').select('*').eq('id', params.documentId).eq('project_id', params.id).maybeSingle();
  if (!doc) return json({ error: 'Document not found.' }, 404);

  await sb.storage.from(BUCKET).remove([doc.storage_path]).catch(() => {});
  const { error } = await sb.from('pm_project_documents').delete().eq('id', params.documentId);
  if (error) { console.error('[project documents] delete failed:', error.message); return json({ error: 'Could not delete the file.' }, 500); }
  return json({ ok: true });
}
