'use strict';

/* Server-side PDF rendering via a REAL Chrome instance (puppeteer-core
   driving Chrome DevTools Protocol's Page.printToPDF). This is the exact
   same engine and approach as apps/quotation/lib/pdf/renderPdfServer.js
   — reused rather than reinvented, so Accounting's PDFs are produced the
   same way as quotation PDFs (real Chrome printing the real preview URL,
   not a from-scratch CSS re-implementation). The only difference from
   the quotation version is the DOM readiness selector: `.idoc` (this
   app's invoice document) instead of `.qdoc`. See the quotation file for the
   full rationale on every choice below — kept identical on purpose. */

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
  sharedBrowserPromise = puppeteer.launch(launchOptions);
  return sharedBrowserPromise;
}

/* Renders `pageUrl` (must be same-origin, reachable by this server
   process) to a PDF buffer using a real headless Chrome tab.
   `cookieHeader` forwards the caller's own session cookie so the
   protected print page authenticates exactly as it would for the user's
   own browser. */
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
    /* Match the viewport's vertical containing block to A4 at 96 CSS dpi
       (297 mm = 1122.52 px). Content still paginates naturally; this only
       keeps bottom:0 fixed print-frame elements inside the physical page
       instead of anchoring them to the old 1200px screen viewport below
       the PDF crop. */
    await page.setViewport({ width: 900, height: 1123, deviceScaleFactor: 2 });

    if (cookieHeader) {
      const url = new URL(pageUrl);
      const cookies = cookieHeader.split(';').map(c => c.trim()).filter(Boolean).map(c => {
        const idx = c.indexOf('=');
        return { name: c.slice(0, idx), value: c.slice(idx + 1), domain: url.hostname, path: '/' };
      });
      if (cookies.length) await page.setCookie(...cookies);
    }

    await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.idoc', { timeout: 15000 });
    /* The sales-invoice QR is fetched from the authenticated server endpoint
       after mount. Wait for its definitive ready/unavailable state before
       collecting images so the PDF never captures a loading placeholder. */
    if (new URL(pageUrl).pathname.includes('/sales-invoices/')) {
      await page.waitForSelector('[data-zatca-status="ready"], [data-zatca-status="unavailable"]', { timeout: 30000 });
    }
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
      const imgs = Array.from(document.images);
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })));
      await new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)));
      if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (_) {} }
    });
    await page.evaluate(async () => {
      const idoc = document.querySelector('.idoc');
      if (!idoc) return;
      let stableCount = 0, lastHeight = -1;
      for (let i = 0; i < 20 && stableCount < 3; i++) {
        const h = idoc.scrollHeight;
        stableCount = h === lastHeight ? stableCount + 1 : 0;
        lastHeight = h;
        await new Promise(res => setTimeout(res, 150));
      }
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    return pdfBuffer;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

module.exports = { renderUrlToPdfBuffer, findBrowserExecutable };
