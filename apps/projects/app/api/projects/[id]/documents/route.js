'use strict';

/* POST /api/projects/[id]/documents — multipart/form-data,
   field "file". Uploads to the "project-documents" Supabase Storage
   bucket (public read, write only via this server-side route using
   the service role key) and records the row in pm_project_documents.
   Images/drawings/documents only ever appear on the Project View
   page — never in the dashboard list, per the brief. */

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const BUCKET = 'project-documents';
const MAX_BYTES = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

export async function POST(req, { params }) {
  const { response, session } = requireSession(req, { adminOnly: true });
  if (response) return response;

  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: 'Expected multipart/form-data with a "file" field.' }, 400); }
  const file = form.get('file');
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large (max 15MB).' }, 400);
  if (file.type && !ALLOWED_TYPES.includes(file.type)) return json({ error: 'Unsupported file type — images and PDFs only.' }, 400);

  const sb = getDb();
  const { data: project } = await sb.from('pm_projects').select('id').eq('id', params.id).maybeSingle();
  if (!project) return json({ error: 'Project not found.' }, 404);

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const path = `${params.id}/${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (uploadErr) { console.error('[project documents] upload failed:', uploadErr.message); return json({ error: 'Could not upload the file. Please try again.' }, 500); }

  const { data: row, error: insertErr } = await sb.from('pm_project_documents').insert({
    project_id: params.id, file_name: file.name, storage_path: path, uploaded_by: session.sub,
  }).select().single();
  if (insertErr) {
    console.error('[project documents] record insert failed:', insertErr.message);
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: 'Could not save the upload record. Please try again.' }, 500);
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  return json({ document: { ...row, url: pub.publicUrl } }, 201);
}

export async function GET(req, { params }) {
  const { response } = requireSession(req);
  if (response) return response;
  const sb = getDb();
  const { data, error } = await sb.from('pm_project_documents').select('*').eq('project_id', params.id).order('created_at', { ascending: false });
  if (error) return json({ error: 'Could not load documents.' }, 500);
  const documents = (data || []).map(d => ({ ...d, url: sb.storage.from(BUCKET).getPublicUrl(d.storage_path).data.publicUrl }));
  return json({ documents });
}
