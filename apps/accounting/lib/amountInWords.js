'use strict';

/* Amount in words for the SmartLife-style receipt voucher (سند صرف), which
   prints the figure spelled out beneath the numeric amount.

   This is PRESENTATION of a real amount — it spells out the value SmartERP
   posted and invents nothing. Saudi convention: riyals + halalas (2 dp),
   matching the reference voucher's "eighty-five saudi riyals zero halalas". */

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = [
  { value: 1e12, name: 'trillion' },
  { value: 1e9, name: 'billion' },
  { value: 1e6, name: 'million' },
  { value: 1e3, name: 'thousand' },
];

function underThousand(n) {
  if (n < 20) return ONES[n];
  if (n < 100) {
    const tens = TENS[Math.floor(n / 10)];
    const rest = n % 10;
    return rest ? `${tens}-${ONES[rest]}` : tens;
  }
  const hundreds = `${ONES[Math.floor(n / 100)]} hundred`;
  const rest = n % 100;
  return rest ? `${hundreds} ${underThousand(rest)}` : hundreds;
}

function wholeToWords(n) {
  if (n === 0) return ONES[0];
  const parts = [];
  let remaining = n;
  for (const scale of SCALES) {
    if (remaining >= scale.value) {
      const count = Math.floor(remaining / scale.value);
      parts.push(`${wholeToWords(count)} ${scale.name}`);
      remaining %= scale.value;
    }
  }
  if (remaining > 0) parts.push(underThousand(remaining));
  return parts.join(' ');
}

/* Returns e.g. "eighty-five saudi riyals zero halalas". Rounds to 2 dp the
   same way the numeric amount on the voucher is rounded, so the words and
   the figure can never disagree. */
function amountInWords(value, { currencyWord = 'saudi riyals', fractionWord = 'halalas' } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  const negative = number < 0;
  const cents = Math.round(Math.abs(number) * 100);
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  const text = `${wholeToWords(whole)} ${currencyWord} ${wholeToWords(fraction)} ${fractionWord}`;
  return negative ? `minus ${text}` : text;
}

module.exports = { amountInWords };
