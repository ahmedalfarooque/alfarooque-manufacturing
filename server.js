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
const { spawn, execSync } = require('child_process');

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
  '/all-products':  'all-products.html',
  '/mohammed':      'mohammed.html',
  '/admin':         'pages/admin/login.html',
  '/woodworks':     'pages/woodworks.html',
  '/steelworks':    'pages/steelworks.html',
  '/aluminium':     'pages/aluminium.html',
  /* Arabic — filename convention (x-ar.html), no /ar/ prefix */
  '/index-ar.html':     'index-ar.html',
  '/products-ar.html':  'products-ar.html',
  '/all-products-ar.html': 'all-products-ar.html',
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
  /* Collect raw Buffer chunks and decode ONCE at the end — string-
     concatenating chunks as they arrive (`raw += chunk`) implicitly
     calls Buffer.toString('utf8') per chunk, which can split a
     multi-byte UTF-8 character across a chunk boundary and corrupt it
     (e.g. a non-ASCII attachment filename in a large multi-MB request
     body, which is exactly the shape of a reply-with-attachments
     payload). Buffer.concat first avoids that entirely. */
  const chunks = [];
  req.on('data', chunk => { chunks.push(chunk); });
  req.on('end', async () => {
    const raw = Buffer.concat(chunks).toString('utf8');
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

/* ── Unified startup banner + readiness tracking ──────────────────────
   `npm run dev` from the repo root is the ONLY command a developer needs
   — this one process brings up the main site plus every managed app
   below. Each app prints its own "✓ … Ready" line as its dev server
   actually finishes compiling (not just "process spawned"), and the
   final "Development environment ready." line only appears once all of
   them have reported in. */
const READY_LABELS = ['Main Website', 'Cars App', 'Projects App', 'Quotation App'];
const readyState = {};
function markReady(label) {
  if (readyState[label]) return;
  readyState[label] = true;
  console.log('  ✓ ' + label + ' Ready');
  if (READY_LABELS.every(l => readyState[l])) console.log('\n  Development environment ready.\n');
}

function printBanner() {
  console.log('\n  ------------------------------------------------------------');
  console.log('  AL FAROOQUE Development Environment\n');
  console.log('  Main Website        http://localhost:' + PORT);
  console.log('  Cars App            http://localhost:3010');
  console.log('  Projects App        http://localhost:3020');
  console.log('  Quotation App       http://localhost:3030\n');
  console.log('  Starting development servers...\n');
}

(async function startAll() {
  printBanner();

  /* Main site's own port needs the same stale-instance cleanup as every
     managed app below — a leftover server.js from a previous run must
     not block this one from binding 3000. */
  const preflight = await freePortIfStale(PORT, 'Main Website');
  if (!preflight.ok) {
    console.error('  Main Website failed to start.');
    console.error('  Reason: ' + preflight.reason);
    console.error('  Free port ' + PORT + ' manually, then try again.\n');
    process.exit(1);
  }

  server.listen(PORT, '127.0.0.1', () => {
    console.log('  [main-site] Static site + API listening on http://localhost:' + PORT);
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

    markReady('Main Website');
  });

  for (const app of MANAGED_APPS) {
    startManagedApp(app).catch(err => {
      console.error('  ' + app.label + ' failed to start.');
      console.error('  Reason: ' + err.message);
      console.error('  The other applications will continue running.\n');
    });
  }
})();

/* ── Auto-start apps/cars, apps/projects and apps/quotation alongside
   the main site ── All three should always be up whenever this server
   runs, instead of remembering to launch each separately (the /cars and
   /projects local proxies above are useless without them anyway).
   Spawns `npm run dev` inside each app dir, restarts it if it crashes
   (capped per app, so a real bug doesn't spin forever), and shuts it
   down cleanly when this process exits. If an app's port is already
   occupied by a leftover Node process from a previous run, that stale
   process is stopped first so this run always starts clean — a process
   holding the port that ISN'T Node is left alone (see freePortIfStale). */
const MAX_RESTARTS = 5;
const MANAGED_APPS = [
  { name: 'cars-app', label: 'Cars App', dir: path.join(ROOT, 'apps', 'cars'), port: 3010 },
  { name: 'projects-app', label: 'Projects App', dir: path.join(ROOT, 'apps', 'projects'), port: 3020 },
  { name: 'quotation-app', label: 'Quotation App', dir: path.join(ROOT, 'apps', 'quotation'), port: 3030 },
].map(app => ({ ...app, child: null, restarts: 0, shuttingDown: false }));

function isPortInUse(port) {
  return new Promise(resolve => {
    const socket = net.connect({ port, host: '127.0.0.1' });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
}

/* Windows-only: find the PID currently LISTENING on `port` via netstat.
   Returns null if none found or on any parse/exec failure (non-Windows,
   netstat unavailable, etc.) — every caller treats null as "don't know,
   leave it alone" rather than guessing. */
function findPidOnPort(port) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execSync('netstat -ano -p tcp', { encoding: 'utf8' });
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/^TCP\s+\S*:(\d+)\s+\S+\s+LISTENING\s+(\d+)/i);
      if (m && Number(m[1]) === port) return Number(m[2]);
    }
  } catch (_) {}
  return null;
}
function isNodeProcess(pid) {
  try {
    const out = execSync('tasklist /FI "PID eq ' + pid + '" /FO CSV /NH', { encoding: 'utf8' });
    return /node\.exe/i.test(out);
  } catch (_) { return false; }
}
/* Kills an entire process tree (Node's child.kill() alone can leave
   grandchild processes — e.g. Next.js's webpack workers — orphaned on
   Windows), falling back to a plain kill() off-Windows. */
function killProcessTree(pid) {
  try {
    if (process.platform === 'win32') execSync('taskkill /F /T /PID ' + pid, { stdio: 'ignore' });
    else process.kill(pid);
  } catch (_) {}
}

/* Pre-flight port check shared by the main site and every managed app:
   if the port is free, nothing to do. If it's held by a Node process
   (almost certainly a previous run of this exact dev environment),
   stop only that process and wait for the port to actually free up. If
   it's held by something else, leave it alone and report why starting
   failed — this app's failure never touches unrelated processes or the
   other three apps. */
async function freePortIfStale(port, label) {
  if (!(await isPortInUse(port))) return { ok: true };
  const pid = findPidOnPort(port);
  if (pid && isNodeProcess(pid)) {
    console.log('  ' + label + ': port ' + port + ' held by a previous instance (PID ' + pid + ') — stopping it…');
    killProcessTree(pid);
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 200));
      if (!(await isPortInUse(port))) return { ok: true };
    }
    return { ok: false, reason: 'Port ' + port + ' is still in use after stopping the previous instance.' };
  }
  return {
    ok: false,
    reason: pid
      ? 'Port ' + port + ' is in use by a non-Node process (PID ' + pid + ') — not stopping it automatically.'
      : 'Port ' + port + ' is in use by another process that could not be identified.',
  };
}

/* Recognizes each dev server's own "compiled and listening" output so
   the "✓ … Ready" banner line reflects reality, not just "the process
   was spawned" (which happens well before Next.js is actually serving
   requests). Matches every phrasing Next.js has used across versions. */
const READY_PATTERNS = [/✓\s*ready/i, /ready - started server/i, /-\s*local:\s*http/i];
function looksReady(text) {
  return READY_PATTERNS.some(re => re.test(text));
}

async function startManagedApp(app) {
  if (!fs.existsSync(app.dir)) return;
  const pre = await freePortIfStale(app.port, app.label);
  if (!pre.ok) throw new Error(pre.reason);

  console.log('  [' + app.name + '] Starting dev server on port ' + app.port + '…');
  try {
    // Explicit PORT env var — without this, `next dev` ignores app.port entirely
    // and defaults to 3000, colliding with the main static site (see the header
    // comment above: this whole file assumes 3000 is exclusively the main site's).
    // stdio is piped (not 'inherit') so this process can watch for the
    // "ready" line to fire the ✓ banner — output is still forwarded to
    // this terminal exactly as before, just relayed rather than direct.
    app.child = spawn('npm', ['run', 'dev'], {
      cwd: app.dir, stdio: ['ignore', 'pipe', 'pipe'], shell: true,
      env: Object.assign({}, process.env, { PORT: String(app.port) }),
    });
  } catch (err) {
    throw new Error('Failed to spawn: ' + err.message);
  }
  const relay = stream => chunk => {
    process.stdout.write(chunk);
    if (looksReady(String(chunk))) markReady(app.label);
  };
  app.child.stdout.on('data', relay('stdout'));
  app.child.stderr.on('data', relay('stderr'));
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
    setTimeout(() => startManagedApp(app).catch(err => console.error('  ' + app.label + ' failed to restart: ' + err.message)), 1000);
  });
}

/* Kills the FULL tree for each managed app (see killProcessTree above) —
   `child.kill()` alone only signals the immediate `npm`/shell process;
   on Windows the actual `next dev` (and its webpack worker processes)
   are grandchildren that would otherwise survive as orphans after this
   terminal closes. */
function stopManagedApps() {
  for (const app of MANAGED_APPS) {
    app.shuttingDown = true;
    if (app.child && app.child.pid) killProcessTree(app.child.pid);
  }
}
process.on('exit', stopManagedApps);
process.on('SIGINT', () => { stopManagedApps(); process.exit(0); });
process.on('SIGTERM', () => { stopManagedApps(); process.exit(0); });
