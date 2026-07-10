'use strict';

/* Product images: multipart upload to the public 'product-images'
   Supabase Storage bucket (auto-created on first use). The product's
   `images` jsonb keeps [{path,url,name}]; `image_path` = primary URL.
   POST (multipart file[]) · PATCH {url} set primary · DELETE {url}.    */

const { getDb } = require('@/lib/db');
const { json, requireSession, requireWrite } = require('@/lib/http');
const { audit } = require('@/lib/crud');

export const runtime = 'nodejs';
const BUCKET = 'product-images';
const MAX_BYTES = 5 * 1024 * 1024;
const MIME_OK = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function ensureBucket(sb) {
  try { await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES }); } catch (_) {}
}

async function getProduct(sb, id) {
  const { data } = await sb.from('qt_catalogue_products')
    .select('id, images, image_path').eq('id', id).is('deleted_at', null).single();
  return data;
}

export async function POST(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const product = await getProduct(sb, params.id);
  if (!product) return json({ error: 'Not found' }, 404);
  await ensureBucket(sb);

  let form;
  try { form = await req.formData(); } catch (e) { return json({ error: 'Bad upload' }, 400); }
  const files = form.getAll('file').filter(f => f && typeof f.arrayBuffer === 'function');
  if (!files.length) return json({ error: 'No files' }, 400);

  const images = Array.isArray(product.images) ? [...product.images] : [];
  for (const file of files) {
    if (!MIME_OK.includes(file.type)) continue;
    if (file.size > MAX_BYTES) continue;
    const ext = (file.name || 'img').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${params.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await sb.storage.from(BUCKET).upload(path, buf, { contentType: file.type });
    if (error) continue;
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    images.push({ path, url: pub.publicUrl, name: file.name || '' });
  }

  const patch = { images, updated_by: session.sub, updated_at: new Date().toISOString() };
  if (!product.image_path && images.length) patch.image_path = images[0].url;
  await sb.from('qt_catalogue_products').update(patch).eq('id', params.id);
  await audit(sb, 'qt_catalogue_products', params.id, 'update', null, { images_added: files.length }, session.sub);
  return json({ images, image_path: patch.image_path || product.image_path });
}

export async function PATCH(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  if (!body.url) return json({ error: 'url required' }, 400);
  await sb.from('qt_catalogue_products')
    .update({ image_path: body.url, updated_by: session.sub, updated_at: new Date().toISOString() })
    .eq('id', params.id);
  return json({ ok: true });
}

export async function DELETE(req, { params }) {
  const { session, response } = await requireWrite(req);
  if (!session) return response;
  const sb = getDb();
  const body = await req.json().catch(() => ({}));
  const product = await getProduct(sb, params.id);
  if (!product) return json({ error: 'Not found' }, 404);
  const images = (Array.isArray(product.images) ? product.images : []).filter(i => i.url !== body.url);
  const removed = (product.images || []).find(i => i.url === body.url);
  if (removed && removed.path) { try { await sb.storage.from(BUCKET).remove([removed.path]); } catch (_) {} }
  const patch = { images, updated_by: session.sub, updated_at: new Date().toISOString() };
  if (product.image_path === body.url) patch.image_path = images.length ? images[0].url : null;
  await sb.from('qt_catalogue_products').update(patch).eq('id', params.id);
  return json({ images, image_path: patch.image_path !== undefined ? patch.image_path : product.image_path });
}
