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

/* ── Load .env.local (zero-dependency — runs before anything else) ── */
(function loadEnvLocal() {
  try {
    const lines = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const key = t.slice(0, eq).trim();
      let val   = t.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (!(key in process.env)) process.env[key] = val;
    }
    console.log('  [env] Loaded .env.local');
  } catch (_) { /* .env.local is optional */ }
})();

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
  '/admin':         'pages/admin/login.html',
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

/* ── API handlers ── */
const emailService = require('./api/_email');

/* Generic Vercel-style API dispatcher for local dev: any request to
   /api/<path> loads ./api/<path>.js and invokes its default export as
   (req, res), mirroring how Vercel routes serverless functions in
   production. Files whose basename starts with "_" are helpers, never
   routed (matches the convention documented in api/_email.js). */
function loadApiHandler(urlPath) {
  const rel = urlPath.replace(/^\/api\//, '');
  if (!rel || rel.split('/').some(seg => seg.startsWith('_') || seg === '..')) return null;
  const filePath = path.join(ROOT, 'api', rel + '.js');
  if (!filePath.startsWith(path.join(ROOT, 'api') + path.sep)) return null; // traversal guard
  if (!fs.existsSync(filePath)) return null;
  try { return require(filePath); } catch (e) { console.error('[api] Failed to load', filePath, e); return null; }
}

function dispatchApi(handler, req, res, urlPath) {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', async () => {
    let parsed = {};
    try { parsed = raw ? JSON.parse(raw) : {}; } catch (_) {}
    req.body = parsed;
    req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);

    let statusCode = 200;
    const apiRes = {
      setHeader: (k, v) => res.setHeader(k, v),
      status(n) { statusCode = n; return this; },
      json(data) {
        if (!res.headersSent) {
          res.writeHead(statusCode, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        }
      },
      end() { if (!res.headersSent) { res.writeHead(statusCode); res.end(); } },
    };

    try {
      await handler(req, apiRes);
    } catch (err) {
      console.error('[' + urlPath + '] Unhandled error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    }
  });
}

/* ── Server ── */
const server = http.createServer((req, res) => {
  /* Strip query + hash, normalise trailing slash, decode percent-encoding */
  let urlPath = req.url.split('?')[0].split('#')[0];
  if (urlPath !== '/' && urlPath.endsWith('/')) urlPath = urlPath.slice(0, -1);
  try { urlPath = decodeURIComponent(urlPath); } catch (e) { /* leave as-is on malformed encoding */ }

  /* 0. API routes — must come before static-file handling */
  if (urlPath.startsWith('/api/')) {
    const handler = loadApiHandler(urlPath);
    if (handler) return dispatchApi(handler, req, res, urlPath);
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

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

  /* ── Email service startup check ── */
  var cfg = emailService.getStatus();
  if (cfg.configured) {
    console.log('  [email] ✓ Configured — provider: ' + cfg.provider +
                ' | from: ' + cfg.from + ' | to: ' + cfg.to + '\n');
  } else {
    console.warn('  ┌──────────────────────────────────────────────────────────┐');
    console.warn('  │  ⚠  EMAIL NOT CONFIGURED — forms will return HTTP 500.     │');
    console.warn('  │  ' + cfg.reason);
    console.warn('  │  Set RESEND_API_KEY, or SMTP_HOST/SMTP_USER/SMTP_PASS,     │');
    console.warn('  │  in .env.local. See .env.example for details.              │');
    console.warn('  └──────────────────────────────────────────────────────────┘\n');
  }
});
