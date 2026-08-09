'use strict';

/* Server-side PDF rendering via a REAL Chrome instance (puppeteer-core
   driving Chrome DevTools Protocol's Page.printToPDF) instead of
   html2canvas rasterizing a DOM snapshot in the browser tab.

   Why this replaced the html2canvas approach: html2canvas is its own
   from-scratch reimplementation of CSS layout/paint — it does not use
   the browser's real rendering engine. It has long-documented gaps in
   CSS Grid support, custom @font-face loading inside its internal DOM
   clone, and RTL/bidi handling. On this specific document (a CSS Grid
   header, custom Arabic web fonts, RTL text) that mismatch surfaced as
   real bugs: header rows overlapping the customer box, footer text
   clipped mid-line — because the pixels html2canvas produced did not
   actually match what the live page measured/showed. Puppeteer instead
   asks a genuine, fully-updated Chrome to print the EXACT SAME URL the
   user previews in their own browser tab, using Chrome's own print
   engine — the same code path as a manual Ctrl+P or "Save as PDF". This
   is the only way to GUARANTEE preview/PDF/print pixel parity for a
   document this CSS-heavy, rather than approximate it.

   Two Chrome sources, so the SAME code path renders identically in both
   places:
   - Local dev (Windows/Mac/Linux with a real browser installed): use
     that install directly via puppeteer-core, zero extra download.
   - Vercel (serverless — no browser present, and no permission to
     install one): @sparticuz/chromium ships a Vercel-compatible headless
     Chromium binary sized to fit the platform's function size limit.
     Without this, production silently fell back to the older
     client-side html2canvas renderer (see buildQuotePdf.js) — which is
     exactly the imprecise renderer this whole file exists to replace. */

const fs = require('fs');

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  process.env.PUPPETEER_EXECUTABLE_PATH,
].filter(Boolean);

function findBrowserExecutable() {
  for (const p of CHROME_CANDIDATES) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

/* Module-scope cache: Vercel (and most serverless platforms) reuse the
   same warm container — and this module's top-level scope with it —
   across consecutive invocations, not just within one. Launching a
   fresh headless Chromium (extracting @sparticuz/chromium's bundled
   libs, spawning the process, waiting for its DevTools socket) is the
   single biggest cost in this whole pipeline, typically 1-3s on its
   own — paid again on EVERY download even when the previous request's
   browser is still sitting there idle. Keeping one browser alive
   across invocations and only opening/closing a PAGE per request skips
   that relaunch entirely on a warm container. isConnected() guards the
   one real edge case: a cold container (or one whose Chromium process
   died/was reclaimed) needs a fresh launch, same as before. */
let sharedBrowserPromise = null;
async function getSharedBrowser(launchOptions) {
  if (sharedBrowserPromise) {
    try {
      const existing = await sharedBrowserPromise;
      if (existing.isConnected()) return existing;
    } catch (_) {
      // fall through and relaunch — the cached launch itself failed
    }
    sharedBrowserPromise = null;
  }
  const puppeteer = require('puppeteer-core');
  /* Assigned before awaiting so concurrent callers on the same warm
     container dedupe onto this one in-flight launch instead of each
     starting their own. Cleared on failure (above) so a bad launch
     doesn't permanently wedge the container into always throwing. */
  sharedBrowserPromise = puppeteer.launch(launchOptions);
  return sharedBrowserPromise;
}

/* Renders `pageUrl` (must be same-origin, reachable by this server
   process) to a PDF buffer using a real headless Chrome tab.
   `cookieHeader` forwards the caller's own session cookie so the
   protected print page authenticates exactly as it would for the user's
   own browser — no separate service-auth/token system needed. */
async function renderUrlToPdfBuffer(pageUrl, { cookieHeader } = {}) {
  const localExecutable = findBrowserExecutable();

  let launchOptions;
  if (localExecutable) {
    launchOptions = {
      executablePath: localExecutable,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--force-color-profile=srgb'],
    };
  } else {
    /* No local browser (serverless) — use the bundled Vercel-compatible
       Chromium build instead of failing over to the old renderer.

       @sparticuz/chromium only extracts its bundled shared libraries
       (libnss3.so and friends) and points LD_LIBRARY_PATH at them when
       isRunningInAwsLambda()/isRunningInAwsLambdaNode20() returns true —
       both of which check for AWS-specific env vars (AWS_EXECUTION_ENV,
       AWS_LAMBDA_JS_RUNTIME). Vercel's functions run on similar
       Amazon-Linux-based infrastructure but never set those vars, so on
       Vercel the package silently skips extracting its own libraries —
       producing "libnss3.so: cannot open shared object file" at launch,
       since the .so files it needs simply never got unpacked. Setting
       AWS_LAMBDA_JS_RUNTIME ourselves (recognized value: any string
       containing "20.x") makes isRunningInAwsLambdaNode20() true,
       triggering the AL2023 library extraction + LD_LIBRARY_PATH setup
       this package needs to actually find its own bundled libraries —
       harmless on real AWS Lambda too, since it only affects this
       package's own internal detection, nothing else. Must be set
       BEFORE requiring the module, since the check runs at module load
       time, not inside executablePath(). */
    process.env.AWS_LAMBDA_JS_RUNTIME ??= 'nodejs20.x';
    let chromium;
    try {
      chromium = require('@sparticuz/chromium');
    } catch (_) {
      throw new Error('No local Chrome/Edge install found, and @sparticuz/chromium is not installed for serverless fallback.');
    }
    launchOptions = {
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      args: [...chromium.args, '--force-color-profile=srgb'],
      defaultViewport: chromium.defaultViewport,
    };
  }

  const browser = await getSharedBrowser(launchOptions);

  let page;
  try {
    page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });

    if (cookieHeader) {
      const url = new URL(pageUrl);
      const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean).map(c => {
        const idx = c.indexOf('=');
        return { name: c.slice(0, idx), value: c.slice(idx + 1), domain: url.hostname, path: '/' };
      });
      if (cookies.length) await page.setCookie(...cookies);
    }

    /* domcontentloaded, not networkidle0: the print page is fully
       client-rendered (fetches the quotation, then terms, then builds
       the QR client-side) — networkidle0 forces an extra unconditional
       500ms-of-silence wait on top of that real data-loading time, on
       EVERY request. The explicit waits right below (.qdoc appearing,
       fonts, images, height stability) already gate on the document
       actually being ready, so they make networkidle0 redundant rather
       than replace a needed guarantee. */
    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.qdoc', { timeout: 15000 });
    /* The QR data-URL is generated client-side AFTER the quotation data
       loads — briefly later than .qdoc itself appears. Wait for it so
       the printed page never captures the pre-QR frame; tolerate its
       absence (short timeout, swallowed) rather than failing the whole
       PDF over a missing decoration. */
    await page.waitForSelector('.qdoc-qr img', { timeout: 5000 }).catch(() => {});
    /* Real fonts, real images, real Grid/RTL layout — wait for both to
       settle before printing so nothing is mid-load in the capture.
       document.fonts.ready is awaited TWICE with a rendered-frame gap in
       between: the Arabic font is loaded from a separate <html> root
       layout, and its own load promise can still be pending — or just
       resolving without having repainted yet — at the moment this
       evaluate() call starts. A single await can therefore resolve
       before the correct font's metrics have actually been applied,
       which is exactly what caused the content-height measurement below
       to read a shorter (wrong-font) height than what actually painted,
       pushing the real render onto an unwanted second page. Waiting
       again after a rendered frame confirms the font that's active NOW
       is stable, not mid-swap. */
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
    });
    /* Belt-and-suspenders on top of the specific waits above: poll the
       document's actual rendered height until it stops changing, rather
       than trusting any fixed list of "wait for X, Y, Z" conditions.
       Terms & Conditions text loads via a SEPARATE API call that only
       fires after the main quotation data resolves (see print/page.js)
       — if that (or anything else async) is still landing after the
       specific waits above are done, the height measured further down
       would be taken from a not-yet-final layout, silently producing a
       wrong single/multi-page decision no matter how many named waits
       precede it. This catches that whole class of issue generically:
       stop as soon as 3 consecutive checks agree, or after 3s regardless
       (never hangs the request on a genuinely-still-loading page). */
    await page.evaluate(async () => {
      const qdoc = document.querySelector('.qdoc');
      if (!qdoc) return;
      let stableCount = 0, lastHeight = -1;
      for (let i = 0; i < 20 && stableCount < 3; i++) {
        const h = qdoc.scrollHeight;
        stableCount = h === lastHeight ? stableCount + 1 : 0;
        lastHeight = h;
        await new Promise(res => setTimeout(res, 150));
      }
    });

    /* Every output page is a physical A4 sheet. Content that does not fit
       flows through Chromium's native pagination; short quotations keep
       the unused portion of their A4 sheet white. Custom content-height
       pages are deliberately forbidden because they produced non-A4
       output and made page framing depend on viewport/DOM measurement. */
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return pdfBuffer;
  } finally {
    /* Close only the PAGE, not the browser — the browser is now a
       shared, warm-reused instance (see getSharedBrowser above) so a
       later request on the same container can skip relaunching it
       entirely. Guard against `page` never having been assigned if
       newPage() itself threw. */
    if (page) await page.close().catch(() => {});
  }
}

module.exports = { renderUrlToPdfBuffer, findBrowserExecutable };
