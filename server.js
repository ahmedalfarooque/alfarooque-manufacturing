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
const net  = require('net');
const { spawn } = require('child_process');

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

/* ── Proxy /cars and /projects to their own Next.js dev servers ──
   Both apps now deploy to their own subdomains (cars.alfarooque.com,
   projects.alfarooque.com) and have no basePath — their dev servers
   expect root-relative paths. The "/cars"/"/projects" prefixes here are
   purely a local convenience (no real subdomains in local dev) and
   must be stripped before forwarding, or every route would 404. */
const PROXY_TARGETS = { '/cars': { port: 3010, stripPrefix: true }, '/projects': { port: 3020, stripPrefix: true } };
function proxyTarget(urlPath) {
  for (const prefix of Object.keys(PROXY_TARGETS)) {
    if (urlPath === prefix || urlPath.startsWith(prefix + '/')) return { prefix, ...PROXY_TARGETS[prefix] };
  }
  return null;
}
function proxyRequest(target, req, res) {
  const { port, prefix, stripPrefix } = target;
  const forwardPath = stripPrefix ? (req.url.slice(prefix.length) || '/') : req.url;
  const upstream = http.request(
    { hostname: '127.0.0.1', port, path: forwardPath, method: req.method, headers: req.headers },
    upstreamRes => {
      res.writeHead(upstreamRes.statusCode, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstream.on('error', () => {
    const appName = port === 3010 ? 'cars-app' : 'projects-app';
    res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!DOCTYPE html><html lang="en"><body style="font-family:sans-serif;max-width:600px;margin:80px auto;padding:0 20px">
<h1>502 — dev server not running on port ${port}</h1>
<p>Start it first: <code>npm --prefix apps/${port === 3010 ? 'cars' : 'projects'} run dev</code></p>
<p>(or via the preview tool's "${appName}" launch config)</p>
</body></html>`);
  });
  req.pipe(upstream);
}

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

  /* 0. Proxy to the Cars/Projects apps — must come first, before the
     /api/ check below, since /cars/api/* and /projects/api/* need to
     reach THOSE apps' own API routes, not this site's. */
  const target = proxyTarget(urlPath);
  if (target) return proxyRequest(target, req, res);

  /* 0.5. API routes — must come before static-file handling */
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

/* Next.js dev servers hot-reload over a WebSocket — without forwarding
   the upgrade too, pages viewed through this proxy would load fine but
   never live-refresh on file changes. */
server.on('upgrade', (req, clientSocket, head) => {
  const urlPath = req.url.split('?')[0];
  const target = proxyTarget(urlPath);
  if (!target) { clientSocket.destroy(); return; }
  const forwardUrl = target.stripPrefix ? (req.url.slice(target.prefix.length) || '/') : req.url;

  const upstreamSocket = require('net').connect(target.port, '127.0.0.1', () => {
    const headerLines = [`${req.method} ${forwardUrl} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) headerLines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
    upstreamSocket.write(headerLines.join('\r\n') + '\r\n\r\n');
    upstreamSocket.write(head);
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
  });
  upstreamSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => upstreamSocket.destroy());
});

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

  for (const app of MANAGED_APPS) {
    startManagedApp(app).catch(err => console.error('  [' + app.name + '] Unexpected error starting: ' + err.message));
  }
});

/* ── Auto-start apps/cars and apps/projects alongside the main site ──
   Both apps should always be up whenever this server runs, instead of
   remembering to launch each separately — the /cars and /projects local
   proxies (see PROXY_TARGETS above) are useless without them anyway.
   Spawns `npm run dev` inside each app dir, restarts it if it crashes
   (capped per app, so a real bug doesn't spin forever), and shuts it
   down when this process exits. Skips spawning an app whose port is
   already occupied (e.g. started manually, or via the preview tool's
   own launch config) rather than fighting over the port. */
const MAX_RESTARTS = 5;
const MANAGED_APPS = [
  { name: 'cars-app', dir: path.join(ROOT, 'apps', 'cars'), port: 3010 },
  { name: 'projects-app', dir: path.join(ROOT, 'apps', 'projects'), port: 3020 },
].map(app => ({ ...app, child: null, restarts: 0, shuttingDown: false }));

function isPortInUse(port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

async function startManagedApp(app) {
  if (!fs.existsSync(app.dir)) return;
  if (await isPortInUse(app.port)) {
    console.log('  [' + app.name + '] Already running on port ' + app.port + ' — leaving it as-is.\n');
    return;
  }
  console.log('  [' + app.name + '] Starting dev server on port ' + app.port + '…');
  try {
    app.child = spawn('npm', ['run', 'dev'], { cwd: app.dir, stdio: 'inherit', shell: true });
  } catch (err) {
    console.error('  [' + app.name + '] Failed to spawn: ' + err.message);
    return;
  }
  app.child.on('error', (err) => {
    console.error('  [' + app.name + '] Failed to start: ' + err.message);
    app.child = null;
  });
  app.child.on('exit', (code) => {
    app.child = null;
    if (app.shuttingDown) return;
    if (app.restarts >= MAX_RESTARTS) {
      console.error('  [' + app.name + '] Exited (code ' + code + ') too many times — giving up. Start it manually to see the error.');
      return;
    }
    app.restarts++;
    console.warn('  [' + app.name + '] Exited unexpectedly (code ' + code + ') — restarting (' + app.restarts + '/' + MAX_RESTARTS + ')…');
    setTimeout(() => startManagedApp(app), 1000);
  });
}

function stopManagedApps() {
  for (const app of MANAGED_APPS) {
    app.shuttingDown = true;
    if (app.child) app.child.kill();
  }
}
process.on('exit', stopManagedApps);
process.on('SIGINT', () => { stopManagedApps(); process.exit(0); });
process.on('SIGTERM', () => { stopManagedApps(); process.exit(0); });
