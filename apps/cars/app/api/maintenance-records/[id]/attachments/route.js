'use strict';

/* POST /api/maintenance-records/[id]/attachments — multipart/
   form-data, fields "file" and "slot" (invoice_pdf|invoice_image|
   before|during|after|document). Uploads to the "maintenance-documents"
   bucket and inserts one row per file — unlike the fixed-slot driver
   photo columns, a record can hold many attachments per slot. */

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const BUCKET = 'maintenance-documents';
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const SLOTS = ['invoice_pdf', 'invoice_image', 'before', 'during', 'after', 'document'];

export async function POST(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: 'Expected multipart/form-data with "file" and "slot".' }, 400); }
  const file = form.get('file');
  const slot = String(form.get('slot') || 'document');
  if (!SLOTS.includes(slot)) return json({ error: 'Invalid attachment slot.' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large (max 15MB).' }, 400);
  if (file.type && !ALLOWED_TYPES.includes(file.type)) return json({ error: 'Unsupported file type — JPG, PNG, WEBP, or PDF only.' }, 400);

  const sb = getDb();
  const { data: record } = await sb.from('car_maintenance_records').select('id').eq('id', params.id).maybeSingle();
  if (!record) return json({ error: 'Maintenance record not found.' }, 404);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${params.id}/${slot}-${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'application/octet-stream' });
  if (uploadErr) { console.error('[maintenance attachment] upload failed:', uploadErr.message); return json({ error: 'Could not upload the file. Please try again.' }, 500); }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const { data: attachment, error: insertErr } = await sb.from('car_maintenance_attachments').insert({
    record_id: params.id, slot, file_name: file.name, storage_path: path, url: pub.publicUrl,
  }).select().single();
  if (insertErr) {
    console.error('[maintenance attachment] record insert failed:', insertErr.message);
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: 'Could not save the attachment. Please try again.' }, 500);
  }

  return json({ attachment }, 201);
}
