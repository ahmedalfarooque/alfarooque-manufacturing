'use strict';

/* GET /api/division-images?division=<slug>
   Public, read-only endpoint — lists image files directly from disk for a
   fixed set of known manufacturing-division folders under assets/images/.
   No database involved, no hardcoded filenames — drop a new photo into the
   folder and it appears on next page load with zero code changes.

   The slug -> folder mapping is an explicit whitelist (not a raw path
   built from user input) so this can never read arbitrary directories. */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'assets', 'images');

const SLUG_TO_FOLDER = {
  'steel-works': 'Steel Works',
  'aluminium-works': 'Aluminium Works',
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/* Hero-slider source images already used elsewhere on the page are
   excluded from the mini-gallery grid so the gallery shows distinct
   project shots rather than repeating the hero background. */
function isHeroImage(filename) {
  return /hero/i.test(filename);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const slug = String(req.query?.division || '').trim();
  const folderName = SLUG_TO_FOLDER[slug];
  if (!folderName) return res.status(400).json({ error: 'Unknown division.' });

  const dirPath = path.join(BASE_DIR, folderName);

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const images = entries
      .filter(e => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()) && !isHeroImage(e.name))
      .map(e => e.name)
      .sort()
      .map(name => '/assets/images/' + encodeURIComponent(folderName) + '/' + encodeURIComponent(name));

    return res.status(200).json({ division: slug, folder: folderName, images });
  } catch (err) {
    console.error('[api/division-images] Failed for "' + slug + '":', err.message);
    return res.status(200).json({ division: slug, folder: folderName, images: [] });
  }
};
