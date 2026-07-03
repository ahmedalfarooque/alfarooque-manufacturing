'use strict';

/* ═══════════════════════════════════════════════════════════════════
   ONE-TIME MIGRATION — seeds public.categories + public.products from
   the existing static catalog in js/products.js.

   This does NOT modify js/products.js or the customer-facing storefront.
   It only reads the PRODUCTS array (via a sandboxed eval of just that
   data literal — no browser globals, no side effects) and upserts the
   exact same data into Supabase so the admin panel has a real, live
   catalog to manage.

   Run once, locally:
     node supabase/migrate-products.js

   Requires env vars (in .env.local or the shell):
     SUPABASE_URL
     SUPABASE_SERVICE_ROLE_KEY
   ═══════════════════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ── Load .env.local the same zero-dependency way server.js does ── */
(function loadEnvLocal() {
  try {
    const lines = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (_) { /* optional */ }
})();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local first.');
  process.exit(1);
}

/* ── Extract the PRODUCTS data literal from js/products.js ── */
const srcPath = path.join(__dirname, '..', 'js', 'products.js');
const src = fs.readFileSync(srcPath, 'utf8');
const lines = src.split(/\r?\n/);

const startIdx = lines.findIndex(l => /^var IS_AR = document/.test(l));

/* Precise boundaries: from the IS_AR line through the closing "];" of
   "var PRODUCTS = [". Found by scanning for the PRODUCTS declaration and
   then the next top-level "];" line at zero indentation. */
const prodDeclIdx = lines.findIndex(l => /^var PRODUCTS = \[/.test(l));
if (startIdx === -1 || prodDeclIdx === -1) {
  console.error('Could not locate the expected markers in js/products.js — aborting (no changes made).');
  process.exit(1);
}
let closeIdx = -1;
for (let i = prodDeclIdx; i < lines.length; i++) {
  if (/^\];\s*$/.test(lines[i])) { closeIdx = i; break; }
}
if (closeIdx === -1) {
  console.error('Could not find the closing "];" for PRODUCTS — aborting.');
  process.exit(1);
}

const dataLines = lines.slice(startIdx, closeIdx + 1);
dataLines[0] = 'var IS_AR = __IS_AR__;'; // replace the document-dependent line

const dataSrc = dataLines.join('\n') + '\nresult = PRODUCTS;\n';

function evalProducts(isAr) {
  const sandbox = {
    t: (en, ar) => (isAr ? ar : en),
    result: null,
  };
  vm.createContext(sandbox);
  const code = dataSrc.replace('__IS_AR__', String(isAr));
  vm.runInContext(code, sandbox, { filename: 'products-data-extract.js' });
  return sandbox.result;
}

const enProducts = evalProducts(false);
const arProducts = evalProducts(true);
console.log('Extracted', enProducts.length, 'products from js/products.js');

/* ── Category display names (from catLabel() in js/products.js) ── */
const CATEGORY_LABELS = {
  doors: ['Doors', 'الأبواب'],
  beds: ['Beds & Accessories', 'الأسرة والإكسسوارات'],
  sofa: ['Sofa', 'الكنب'],
  'Aluminium Windows': ['Aluminium Windows', 'نوافذ الألمنيوم'],
  'Fire Rated Doors': ['Fire Rated Doors', 'أبواب مقاومة للحريق'],
};
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function main() {
  /* supabase-js v2's Realtime client requires a native WebSocket global,
     which only exists on Node 22+. This script never uses realtime — the
     polyfill just satisfies the constructor check on older Node so the
     one-off migration can still run (needs `npm install ws` locally). */
  if (typeof global.WebSocket === 'undefined') global.WebSocket = require('ws');

  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  /* Categories */
  const catSlugs = Array.from(new Set(enProducts.map(p => p.cat)));
  const categoryRows = catSlugs.map((cat, i) => ({
    slug: slugify(cat),
    name: (CATEGORY_LABELS[cat] || [cat, cat])[0],
    name_ar: (CATEGORY_LABELS[cat] || [cat, cat])[1],
    sort_order: i,
    is_active: true,
  }));
  const { error: catErr } = await sb.from('categories').upsert(categoryRows, { onConflict: 'slug' });
  if (catErr) { console.error('Category upsert failed:', catErr.message); process.exit(1); }
  console.log('Upserted', categoryRows.length, 'categories:', catSlugs.join(', '));

  /* Products */
  const productRows = enProducts.map((p, i) => {
    const ar = arProducts[i];
    const images = p.imgs || (p.img ? [p.img] : []);
    return {
      id: p.id,
      category_slug: slugify(p.cat),
      name: p.name,
      name_ar: p.nameAr || null,
      description: p.desc || null,
      description_ar: p.descAr || null,
      price: p.price || 0,
      stock: 100, // no stock tracking existed before — sane default, editable in admin
      material: p.material || null,
      availability: p.availability || 'In Stock',
      rating: p.rating || 0,
      review_count: p.reviewCount || 0,
      badge: p.badge || null,
      is_featured: !!p.featured,
      is_active: true,
      tags: p.tags || [],
      images,
      features: p.features || [],
      features_ar: p.featuresAr || [],
      specs: p.specs || {},
      specs_ar: p.specsAr || {},
      applications: p.applications || [],
      applications_ar: p.applicationsAr || [],
      finishes: p.finishes || [],
      finishes_ar: p.finishesAr || [],
      sizes: p.sizes || [],
      sizes_ar: ar.sizes || [],
      warranty_label: p.warrantyLabel || null,
      warranty_label_ar: p.warrantyLabelAr || null,
    };
  });

  const { error: prodErr } = await sb.from('products').upsert(productRows, { onConflict: 'id' });
  if (prodErr) { console.error('Product upsert failed:', prodErr.message); process.exit(1); }
  console.log('Upserted', productRows.length, 'products (ids ' + productRows.map(p => p.id).join(', ') + ')');
  console.log('\nDone. The admin panel now has the real catalog to manage.');
}

main().catch(err => { console.error(err); process.exit(1); });
