'use strict';

/* Same proxy-storage pattern as projects/[id]/documents — files live in
   the existing "project-documents" bucket under a purchase-requests/
   prefix, never exposed as a raw supabase.co URL. Allowed types match
   the spec: images, PDF, Excel, Word, ZIP. */

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

const BUCKET = 'project-documents';
const MAX_BYTES = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip', 'application/x-zip-compressed',
];

export async function POST(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: pr } = await sb.from('pm_purchase_requests').select('project_id').eq('id', params.id).maybeSingle();
  if (!pr) return json({ error: 'Purchase request not found.' }, 404);
  if (!(await isAssignedOrAdmin(session, pr.project_id))) return json({ error: 'You do not have access to this purchase request.' }, 403);

  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large (max 20MB).' }, 400);
  if (file.type && !ALLOWED_TYPES.includes(file.type)) return json({ error: 'Unsupported file type.' }, 400);

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${pr.project_id}/purchase-requests/${params.id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (uploadErr) { console.error('[pr attachments] upload failed:', uploadErr.message); return json({ error: 'Could not upload the file. Please try again.' }, 500); }

  const { data: row, error: insertErr } = await sb.from('pm_purchase_request_attachments').insert({
    purchase_request_id: params.id, file_name: file.name, storage_path: path, uploaded_by: session.sub,
  }).select().single();
  if (insertErr) {
    console.error('[pr attachments] record insert failed:', insertErr.message);
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: 'Could not save the upload record. Please try again.' }, 500);
  }

  return json({ attachment: { ...row, url: `/api/purchase-requests/${params.id}/attachments/${row.id}` } }, 201);
}
