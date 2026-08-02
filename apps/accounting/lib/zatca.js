'use strict';

/* ZATCA (Saudi Zakat, Tax and Customs Authority) Phase 1 e-invoicing QR
   code — the "simplified tax invoice" QR payload required on every VAT
   invoice shown to a customer. This is the Phase 1 (generation) format:
   a Base64-encoded TLV (Tag-Length-Value) byte sequence with 5 fields.
   Phase 2 (integration with ZATCA's API, cryptographic stamps, UUIDs)
   is out of scope — this covers the QR code requirement only.

   Field tags per ZATCA spec:
     1 = Seller name
     2 = VAT registration number
     3 = Invoice timestamp (ISO 8601)
     4 = Invoice total (with VAT), as a string
     5 = VAT total, as a string
*/

function tlvField(tag, value) {
  const valueBytes = Buffer.from(String(value), 'utf8');
  const header = Buffer.from([tag, valueBytes.length]);
  return Buffer.concat([header, valueBytes]);
}

/* Returns the Base64 string to encode into a QR code. */
function buildZatcaTlvBase64({ sellerName, vatNumber, timestamp, total, vatTotal }) {
  const buf = Buffer.concat([
    tlvField(1, sellerName || ''),
    tlvField(2, vatNumber || ''),
    tlvField(3, timestamp || new Date().toISOString()),
    tlvField(4, Number(total || 0).toFixed(2)),
    tlvField(5, Number(vatTotal || 0).toFixed(2)),
  ]);
  return buf.toString('base64');
}

module.exports = { buildZatcaTlvBase64 };
