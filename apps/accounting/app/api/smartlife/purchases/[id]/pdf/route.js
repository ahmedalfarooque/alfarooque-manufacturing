'use strict';

/* Server-side "Download PDF" / "Print" endpoint for a SmartLife purchase —
   identical pattern to app/api/smartlife/sales-invoices/[id]/pdf, pointed at
   the purchase print page instead. Same renderer, same template engine. */

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

  const printUrl = `${url.origin}/smartlife/purchases/${id}/print?lang=${lang}`;
  const cookieHeader = req.headers.get('cookie') || '';

  try {
    const pdfBuffer = await renderUrlToPdfBuffer(printUrl, { cookieHeader });
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="purchase-${id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[api/smartlife/purchases/[id]/pdf] Failed:', err.message);
    return new Response(JSON.stringify({ error: err.message || 'Could not generate PDF.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
