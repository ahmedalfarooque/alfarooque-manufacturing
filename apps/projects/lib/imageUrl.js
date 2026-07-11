'use strict';

/* Resolves a product image path to an absolute, always-loadable URL.

   Product images are stored as repo-relative paths against the MAIN
   static site's own file structure (e.g. "assets/images/gallery/foo.jpg")
   — see js/admin/dashboard.js's imgUrl(), which just root-anchors that
   with a leading "/". That works on the Website Admin because it's
   served from the exact same origin as those static files.

   ProTrack is a SEPARATE Next.js app on its own origin (a different
   port locally, a different subdomain in production) — a bare
   "/assets/..." 404s here, because ProTrack has no such folder of its
   own. This mirrors the admin's exact same rule (root-anchor a bare
   relative path; pass an already-absolute URL through untouched, so a
   future real Supabase Storage/CDN URL keeps working with no change
   here) and adds the one thing that's actually different: prefixing
   with the main site's origin, where these files really live. */

const MAIN_SITE_ORIGIN = (process.env.MAIN_SITE_URL || process.env.NEXT_PUBLIC_MAIN_SITE_URL || 'https://www.alfarooque.com').replace(/\/+$/, '');

function imgUrl(src) {
  if (!src) return '';
  if (/^(https?:)?\/\//.test(src)) return src; // already absolute — pass through unchanged
  const path = src.charAt(0) === '/' ? src : '/' + src;
  return MAIN_SITE_ORIGIN + path;
}

module.exports = { imgUrl, MAIN_SITE_ORIGIN };
