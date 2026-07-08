'use strict';

/* GET /api/category-images?category=<slug>
   Public, read-only endpoint — lists image files directly from disk for a
   fixed set of known category folders under assets/images/E-commerse Home
   Images/. No database involved. Folder contents can change at any time
   (drop in new images, they show up on next page load) without touching
   this file or any front-end code — the whole point is no hardcoded
   filenames anywhere.

   The slug -> folder mapping is an explicit whitelist (not a raw path
   built from user input) so this can never be used to read arbitrary
   directories on the server. */

const fs = require('fs');
const path = require('path');

const BASE_DIR = path.join(__dirname, '..', 'assets', 'images', 'E-commerse Home Images');

const SLUG_TO_FOLDER = {
  'doors': 'Doors',
  'tables': 'Tables',
  'sofa': 'Sofa',
  'beds': 'Beds and Accessories',
  'wardrobes-cupboards': 'Wardrobes and Cupboards',
};

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');

  const slug = String(req.query?.category || '').trim();
  const folderName = SLUG_TO_FOLDER[slug];
  if (!folderName) return res.status(400).json({ error: 'Unknown category.' });

  const dirPath = path.join(BASE_DIR, folderName);

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const images = entries
      .filter(e => e.isFile() && IMAGE_EXTENSIONS.has(path.extname(e.name).toLowerCase()))
      .map(e => e.name)
      .sort()
      .map(name => '/assets/images/E-commerse%20Home%20Images/' + encodeURIComponent(folderName) + '/' + encodeURIComponent(name));

    return res.status(200).json({ category: slug, folder: folderName, images });
  } catch (err) {
    console.error('[api/category-images] Failed for "' + slug + '":', err.message);
    return res.status(200).json({ category: slug, folder: folderName, images: [] });
  }
};
