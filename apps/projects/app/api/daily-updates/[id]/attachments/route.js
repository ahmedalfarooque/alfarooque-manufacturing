'use strict';

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession, isAssignedOrAdmin } = require('@/lib/http');

const BUCKET = 'project-documents';
const MAX_BYTES = 50 * 1024 * 1024; // 50MB (video-friendly)
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
];

export async function POST(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const sb = getDb();
  const { data: du } = await sb.from('pm_daily_updates').select('project_id').eq('id', params.id).maybeSingle();
  if (!du) return json({ error: 'Daily update not found.' }, 404);
  if (!(await isAssignedOrAdmin(session, du.project_id))) return json({ error: 'You do not have access to this daily update.' }, 403);

  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large (max 50MB).' }, 400);
  if (file.type && !ALLOWED_TYPES.includes(file.type)) return json({ error: 'Unsupported file type.' }, 400);

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${du.project_id}/daily-updates/${params.id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (uploadErr) { console.error('[du attachments] upload failed:', uploadErr.message); return json({ error: 'Could not upload the file. Please try again.' }, 500); }

  const { data: row, error: insertErr } = await sb.from('pm_daily_update_attachments').insert({
    daily_update_id: params.id, file_name: file.name, storage_path: path, uploaded_by: session.sub,
  }).select().single();
  if (insertErr) {
    console.error('[du attachments] record insert failed:', insertErr.message);
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: 'Could not save the upload record. Please try again.' }, 500);
  }

  return json({ attachment: { ...row, url: `/api/daily-updates/${params.id}/attachments/${row.id}` } }, 201);
}
