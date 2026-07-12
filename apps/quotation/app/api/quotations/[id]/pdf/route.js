'use strict';

/* Server-side "Download PDF" / "Print" endpoint — prints the SAME
   protected print page (/quotations/[id]/print?lang=) a real headless
   Chrome tab, via lib/pdf/renderPdfServer.js. See that file for why this
   replaced the earlier client-side html2canvas pipeline: html2canvas is
   not the actual browser rendering engine and could not reliably
   reproduce this document's CSS Grid header + custom Arabic web fonts +
   RTL layout, which is why the preview and the generated file kept
   drifting apart. This route asks a real Chrome to print the exact same
   URL the user already sees, so there is nothing left to keep in sync —
   preview and PDF are the same render, produced the same way. */

const { requireSession } = require('@/lib/http');
const { renderUrlToPdfBuffer } = require('@/lib/pdf/renderPdfServer');

/* Node runtime required — puppeteer-core/@sparticuz/chromium launch a
   real child process, which the Edge runtime cannot do. Launching
   Chromium cold + navigating + printing routinely takes longer than
   Vercel's default 10s function timeout; 60s gives real headroom
   (Vercel still caps this to whatever the plan actually allows). */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req, { params }) {
  const { response, session } = requireSession(req);
  if (response) return response;

  const { id } = params;
  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';

  const printUrl = `${url.origin}/quotations/${id}/print?lang=${lang}`;
  const cookieHeader = req.headers.get('cookie') || '';

  try {
    const pdfBuffer = await renderUrlToPdfBuffer(printUrl, { cookieHeader });
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="quotation-${id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/quotations/[id]/pdf] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message || 'Could not generate PDF.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
