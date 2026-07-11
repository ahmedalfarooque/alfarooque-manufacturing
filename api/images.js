'use strict';

/* GET /api/images?set=<slug>
   Public, read-only endpoint — lists image files directly from disk for a
   fixed whitelist of asset folders (e-commerce category showcases + the
   Services page division galleries). One endpoint on purpose: the Vercel
   Hobby plan caps deployments at 12 serverless functions and this repo
   sits exactly at that cap, so category-images.js and division-images.js
   were merged into this single function.

   No database involved, no hardcoded filenames anywhere — drop a new
   image into a folder and it appears on next page load (locally
   immediately; on Vercel with the next deploy, since the folders ship
   inside the function bundle via vercel.json includeFiles).

   The slug -> folder mapping is an explicit whitelist (never a raw path
   built from user input) so this can never read arbitrary directories. */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'assets', 'images');

const SETS = {
  /* E-commerce category showcases (products.html) */
  'doors':               { folder: 'E-commerse Home Images/Doors' },
  'tables':              { folder: 'E-commerse Home Images/Tables' },
  'sofa':                { folder: 'E-commerse Home Images/Sofa' },
  'beds':                { folder: 'E-commerse Home Images/Beds and Accessories' },
  'wardrobes-cupboards': { folder: 'E-commerse Home Images/Wardrobes and Cupboards' },
  /* Services page division galleries — hero-slider shots are excluded so
     the gallery shows distinct photos instead of repeating the hero. */
  'steel-works':         { folder: 'Steel Works', excludeHero: true },
  'aluminium-works':     { folder: 'Aluminium Works', excludeHero: true },
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  /* Folder listings only change when files are added — locally on next
     request (max-age=300 keeps the browser from re-asking on every
     navigation), in production only with a deploy (each deploy gets a
     fresh CDN cache, so s-maxage can be generous). */
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400');

  const slug = String(req.query?.set || '').trim();
  const set = SETS[slug];
  if (!set) return res.status(400).json({ error: 'Unknown image set.' });

  const dirPath = path.join(BASE_DIR, set.folder);

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const names = entries
      .filter(e =>
        e.isFile() &&
        IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()) &&
        !(set.excludeHero && /hero/i.test(e.name)))
      .map(e => e.name);
    /* Prefer a compressed .webp sibling over its heavy png/jpg original
       (originals are kept on disk but shouldn't be double-listed/served). */
    const webpBases = new Set(names.filter(n => n.toLowerCase().endsWith('.webp')).map(n => n.slice(0, n.lastIndexOf('.'))));
    const images = names
      .filter(n => n.toLowerCase().endsWith('.webp') || !webpBases.has(n.slice(0, n.lastIndexOf('.'))))
      .sort()
      .map(name =>
        '/assets/images/' +
        set.folder.split('/').map(encodeURIComponent).join('/') +
        '/' + encodeURIComponent(name));

    return res.status(200).json({ set: slug, folder: set.folder, images });
  } catch (err) {
    console.error('[api/images] Failed for "' + slug + '":', err.message);
    return res.status(200).json({ set: slug, folder: set.folder, images: [] });
  }
};
