'use strict';

/* POST /api/drivers/[id]/photo — multipart/form-data, fields
   "file" and "slot" (one of profile_photo|license_front|license_back|
   iqama_front|iqama_back). Uploads to the "driver-documents" bucket
   and writes the resulting public URL onto the matching drivers
   column — same pattern as the Projects app's project-documents
   upload, adapted for these fixed-purpose image slots instead of a
   free-form document list. */

const crypto = require('crypto');
const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');

const BUCKET = 'driver-documents';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — these are phone-camera photos of ID cards, not scans
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SLOT_COLUMNS = {
  profile_photo: 'profile_photo_url',
  license_front: 'license_front_url',
  license_back: 'license_back_url',
  iqama_front: 'iqama_front_url',
  iqama_back: 'iqama_back_url',
};

export async function POST(req, { params }) {
  const { response } = requireSession(req, { adminOnly: true });
  if (response) return response;

  let form;
  try { form = await req.formData(); } catch (_) { return json({ error: 'Expected multipart/form-data with "file" and "slot".' }, 400); }
  const file = form.get('file');
  const slot = form.get('slot');
  const column = SLOT_COLUMNS[slot];
  if (!column) return json({ error: 'Invalid photo slot.' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function') return json({ error: 'No file uploaded.' }, 400);
  if (file.size > MAX_BYTES) return json({ error: 'File is too large (max 8MB).' }, 400);
  if (file.type && !ALLOWED_TYPES.includes(file.type)) return json({ error: 'Unsupported file type — JPG, PNG, or WEBP only.' }, 400);

  const sb = getDb();
  const { data: driver } = await sb.from('drivers').select('id').eq('id', params.id).maybeSingle();
  if (!driver) return json({ error: 'Driver not found.' }, 404);

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${params.id}/${slot}-${crypto.randomUUID()}.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: uploadErr } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type || 'image/jpeg' });
  if (uploadErr) { console.error('[driver photo] upload failed:', uploadErr.message); return json({ error: 'Could not upload the photo. Please try again.' }, 500); }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
  const { data: updated, error: updateErr } = await sb.from('drivers').update({ [column]: pub.publicUrl }).eq('id', params.id).select().single();
  if (updateErr) {
    console.error('[driver photo] record update failed:', updateErr.message);
    await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    return json({ error: 'Could not save the photo. Please try again.' }, 500);
  }

  return json({ driver: updated, url: pub.publicUrl });
}
