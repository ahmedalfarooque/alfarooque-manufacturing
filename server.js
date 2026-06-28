/* ═══════════════════════════════════════════
   AL FAROOQUE Manufacturing — Dev server
   Pure Node.js, zero dependencies.
   Maps clean URLs → static HTML files.
   Usage:  node server.js
   ═══════════════════════════════════════════ */
'use strict';
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

/* ── Route table ── */
const ROUTES = {
  '/':              'index.html',
  '/about':         'pages/about.html',
  '/services':      'pages/services.html',
  '/gallery':       'pages/gallery.html',
  '/contact':       'pages/contact.html',
  '/products':      'products.html',
  '/mohammed':      'mohammed.html',
  '/woodworks':     'pages/woodworks.html',
  '/steelworks':    'pages/steelworks.html',
  '/aluminium':     'pages/aluminium.html',
  /* Arabic — filename convention (x-ar.html), no /ar/ prefix */
  '/index-ar.html':     'index-ar.html',
  '/products-ar.html':  'products-ar.html',
};

/* ── MIME types ── */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.xml':  'application/xml',
  '.txt':  'text/plain',
  '.zip':  'application/zip',
};

/* ── Server ── */
const server = http.createServer((req, res) => {
  /* Strip query + hash, normalise trailing slash, decode percent-encoding */
  let urlPath = req.url.split('?')[0].split('#')[0];
  if (urlPath !== '/' && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
  try { urlPath = decodeURIComponent(urlPath); } catch (e) { /* leave as-is on malformed encoding */ }

  /* 1. Try route table */
  const routed = ROUTES[urlPath];
  if (routed) return serve(path.join(ROOT, routed), res, urlPath);

  /* 2. Serve static asset directly */
  const filePath = path.join(ROOT, urlPath);
  /* Directory traversal guard */
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  serve(filePath, res, urlPath);
});

function serve(filePath, res, urlPath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      /* Try .html fallback */
      if (!path.extname(filePath)) {
        return fs.readFile(filePath + '.html', (err2, d2) => {
          if (err2) return send404(res, urlPath);
          send(res, 200, '.html', d2);
        });
      }
      return send404(res, urlPath);
    }
    send(res, 200, path.extname(filePath).toLowerCase(), data);
  });
}

function send(res, code, ext, body) {
  res.writeHead(code, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(body);
}

function send404(res, url) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(`<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:600px;margin:80px auto;padding:0 20px">
<h1>404 — Page Not Found</h1><p><code>${url}</code></p><a href="/">← Home</a>
</body></html>`);
}

server.listen(PORT, '127.0.0.1', () => {
  console.log('\n  AL FAROOQUE Manufacturing — dev server');
  console.log('  http://localhost:' + PORT + '\n');
  console.log('  Routes registered: ' + Object.keys(ROUTES).length);
  console.log('  Static assets served from: ' + ROOT + '\n');
});
