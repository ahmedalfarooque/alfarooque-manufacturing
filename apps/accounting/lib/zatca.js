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

class ZatcaDataError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ZatcaDataError';
    this.field = field;
  }
}

function requiredText(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new ZatcaDataError(`${field} is required for the ZATCA QR.`, field);
  return text;
}

function moneyText(value, field) {
  const raw = requiredText(value, field).replace(/,/g, '');
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) throw new ZatcaDataError(`${field} is not a valid monetary value.`, field);
  const whole = match[1].replace(/^0+(?=\d)/, '');
  const fraction = match[2] || '';
  let cents = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
  if ((fraction[2] || '0') >= '5') cents += 1n;
  return `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`;
}

/* SmartLife stores Saudi local timestamps as YYYY-MM-DD HH:mm:ss. Preserve
   that wall-clock value and make its timezone explicit; never substitute the
   time at which a user happens to open the invoice. Already-zoned ISO values
   are retained exactly. A date without a stored time is not sufficient. */
function normalizeInvoiceTimestamp(value) {
  const text = requiredText(value, 'Invoice timestamp');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return text;
  const local = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?)$/);
  if (local) return `${local[1]}T${local[2]}${process.env.NEXT_PUBLIC_COMPANY_TIMEZONE_OFFSET || '+03:00'}`;
  throw new ZatcaDataError('Invoice timestamp must include the stored invoice time.', 'Invoice timestamp');
}

function tlvField(tag, value) {
  const valueBytes = Buffer.from(requiredText(value, `Tag ${tag}`), 'utf8');
  if (valueBytes.length > 255) throw new ZatcaDataError(`Tag ${tag} exceeds the one-byte ZATCA TLV length limit.`, `Tag ${tag}`);
  const header = Buffer.from([tag, valueBytes.length]);
  return Buffer.concat([header, valueBytes]);
}

/* Returns the Base64 string to encode into a QR code. */
function buildZatcaTlvBase64({ sellerName, vatNumber, timestamp, total, vatTotal }) {
  const values = {
    sellerName: requiredText(sellerName, 'Seller name'),
    vatNumber: requiredText(vatNumber, 'Seller VAT number'),
    timestamp: normalizeInvoiceTimestamp(timestamp),
    total: moneyText(total, 'Invoice total'),
    vatTotal: moneyText(vatTotal, 'VAT total'),
  };
  const buf = Buffer.concat([
    tlvField(1, values.sellerName),
    tlvField(2, values.vatNumber),
    tlvField(3, values.timestamp),
    tlvField(4, values.total),
    tlvField(5, values.vatTotal),
  ]);
  return buf.toString('base64');
}

function decodeZatcaTlvBase64(payload) {
  const buffer = Buffer.from(requiredText(payload, 'ZATCA payload'), 'base64');
  const fields = {};
  for (let offset = 0; offset < buffer.length;) {
    if (offset + 2 > buffer.length) throw new ZatcaDataError('Truncated ZATCA TLV header.', 'ZATCA payload');
    const tag = buffer[offset++];
    const length = buffer[offset++];
    if (offset + length > buffer.length) throw new ZatcaDataError(`Truncated ZATCA TLV value for tag ${tag}.`, 'ZATCA payload');
    fields[tag] = buffer.subarray(offset, offset + length).toString('utf8');
    offset += length;
  }
  return fields;
}

function first(record, keys) {
  for (const key of keys) if (record?.[key] !== undefined && record?.[key] !== null && record?.[key] !== '') return record[key];
  return null;
}

function buildSalesInvoiceZatcaData(invoice, seller) {
  const fields = {
    sellerName: seller?.sellerName,
    vatNumber: seller?.vatNumber,
    timestamp: first(invoice, ['invoice_timestamp', 'date', 'invoice_date', 'created_at']),
    total: first(invoice, ['grand_total', 'total_amount', 'amount']),
    vatTotal: first(invoice, ['total_tax', 'vat_amount', 'tax_amount', 'vat', 'tax']),
  };
  const payload = buildZatcaTlvBase64(fields);
  return { payload, fields: decodeZatcaTlvBase64(payload) };
}

module.exports = {
  ZatcaDataError, tlvField, moneyText, normalizeInvoiceTimestamp, buildZatcaTlvBase64,
  decodeZatcaTlvBase64, buildSalesInvoiceZatcaData,
};
