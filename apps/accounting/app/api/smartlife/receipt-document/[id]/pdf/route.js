'use strict';

/* Server-rendered PDF of the receipt voucher. Reuses the SAME existing
   Puppeteer renderer the sales-invoice PDF uses (lib/pdf/renderPdfServer),
   pointed at the receipt print page — so the PDF is a byte-faithful render
   of the very document the user sees and prints, with no second template
   and no separate data path. */

const { json, requireAction } = require('@/lib/http');
const { renderUrlToPdfBuffer } = require('@/lib/pdf/renderPdfServer');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req, { params }) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  if (!/^\d+$/.test(String(params.id))) return json({ error: 'Invalid receipt id.' }, 400);

  const origin = new URL(req.url).origin;
  const lang = new URL(req.url).searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const pageUrl = `${origin}/smartlife/receipt/${params.id}/print?lang=${lang}&pdf=1`;
  try {
    const buffer = await renderUrlToPdfBuffer(pageUrl, { cookieHeader: req.headers.get('cookie') || '' });
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-${params.id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return json({ error: 'Server-side PDF generation is unavailable. Use Print instead.' }, 503);
  }
}
