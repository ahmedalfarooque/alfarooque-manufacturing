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

/* Renders `pageUrl` (must be same-origin, reachable by this server
   process) to a PDF buffer using a real headless Chrome tab.
   `cookieHeader` forwards the caller's own session cookie so the
   protected print page authenticates exactly as it would for the user's
   own browser — no separate service-auth/token system needed. */
async function renderUrlToPdfBuffer(pageUrl, { cookieHeader } = {}) {
  const localExecutable = findBrowserExecutable();
  const puppeteer = require('puppeteer-core');

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

  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 900, height: 1200, deviceScaleFactor: 2 });

    if (cookieHeader) {
      const url = new URL(pageUrl);
      const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean).map(c => {
        const idx = c.indexOf('=');
        return { name: c.slice(0, idx), value: c.slice(idx + 1), domain: url.hostname, path: '/' };
      });
      if (cookies.length) await page.setCookie(...cookies);
    }

    await page.goto(pageUrl, { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForSelector('.qdoc', { timeout: 15000 });
    /* The QR data-URL is generated client-side AFTER the quotation data
       loads — briefly later than .qdoc itself appears. Wait for it so
       the printed page never captures the pre-QR frame; tolerate its
       absence (short timeout, swallowed) rather than failing the whole
       PDF over a missing decoration. */
    await page.waitForSelector('.qdoc-qr img', { timeout: 5000 }).catch(() => {});
    /* Real fonts, real images, real Grid/RTL layout — wait for both to
       settle before printing so nothing is mid-load in the capture. */
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
    });

    /* A physical PDF page is a fixed size — unlike the on-screen view,
       which just ends wherever the content ends. Using format:'A4'
       unconditionally means EVERY document gets a full 297mm-tall page
       regardless of how short its actual content is, leaving blank
       paper below the footer for any quotation shorter than a full
       page (true in every environment identically — this was never a
       localhost-vs-live difference, just an unaddressed side effect of
       "always generate a proper A4 page"). Measure the real content
       height and use a CUSTOM page height matching it exactly — still
       210mm wide (correct A4 width) — so a short quotation's PDF page
       ends exactly where its content ends, same as the preview. Only
       fall back to standard paginated A4 (297mm per page) once content
       genuinely needs more than one page.

       This ONLY works because the page's own @page rule (print/page.js)
       no longer declares `size: A4`. With that CSS declaration present,
       Chrome's print engine SWAPPED width/height in the output whenever
       the requested width exceeded the requested height (i.e. for every
       quotation shorter than 210mm tall) — confirmed by direct testing
       with pdf-lib against the actual generated bytes, not just visual
       inspection. Page size must be controlled from exactly one place;
       it's this JS call now. */
    const PAGE_W_MM = 210, PAGE_H_MM = 297;
    const contentHeightMm = await page.evaluate((pageWmm) => {
      const qdoc = document.querySelector('.qdoc');
      const rect = qdoc.getBoundingClientRect();
      const pxPerMm = rect.width / pageWmm;
      return qdoc.scrollHeight / pxPerMm;
    }, PAGE_W_MM);

    const pdfBuffer = contentHeightMm <= PAGE_H_MM
      ? await page.pdf({
          width: `${PAGE_W_MM}mm`,
          height: `${contentHeightMm}mm`,
          printBackground: true,
        })
      : await page.pdf({
          format: 'A4',
          printBackground: true,
          preferCSSPageSize: true, // honors the page's own @page { size: A4; margin: 0 } rule for standard multi-page pagination
        });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { renderUrlToPdfBuffer, findBrowserExecutable };
