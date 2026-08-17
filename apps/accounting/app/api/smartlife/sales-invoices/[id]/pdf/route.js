'use strict';

/* Server-side "Download PDF" / "Print" endpoint for a SmartLife sales
   invoice — same pattern as apps/quotation/app/api/quotations/[id]/pdf:
   prints the SAME protected print page with a real headless Chrome tab
   via lib/pdf/renderPdfServer.js, so the preview and the generated file
   are never out of sync. */

const { requireSession , requireAction } = require('@/lib/http');
const { renderUrlToPdfBuffer } = require('@/lib/pdf/renderPdfServer');

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;

  const { id } = params;
  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';

  const printUrl = `${url.origin}/smartlife/sales-invoices/${id}/print?lang=${lang}`;
  const cookieHeader = req.headers.get('cookie') || '';

  try {
    const pdfBuffer = await renderUrlToPdfBuffer(printUrl, { cookieHeader });
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="invoice-${id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/smartlife/sales-invoices/[id]/pdf] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message || 'Could not generate PDF.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
