'use strict';

/* Derives a short, displayable project name from the start of a long
   project-details description, for when the user leaves "Project
   Name" blank. Two paths: Arabic text (no case concept, so just a
   clean truncation at a natural break) and Latin/English text (cuts at
   a natural break, swaps "and" for "&", then title-cases with a small
   list of words kept lowercase so it doesn't read like a robot wrote
   it — "Supply & Installation of Wooden Doors", not
   "Supply & Installation Of Wooden Doors"). */

const SMALL_WORDS = new Set(['of', 'the', 'for', 'in', 'a', 'to', 'on', 'at', 'by', 'an', 'with']);
const ARABIC_RE = /[؀-ۿ]/;

/* Break on " for ", a dash/slash/comma/colon, or a period — but NOT a
   period that's a decimal point inside a measurement (90.90, 1.60,
   0.50 are everywhere in these descriptions; splitting on those
   produced broken half-numbers like "مكتب حرف L 1" and "طاولة مقاس 0"). */
const BREAK_RE = /\s+for\s|(?<!\d)\.(?!\d)|[-–—/,:]/i;

function truncateAtBreak(text, maxLen) {
  const slice = text.slice(0, maxLen + 30);
  const head = slice.slice(0, 10);
  const tail = slice.slice(10);
  const m = tail.match(BREAK_RE);
  const cut = m ? head + tail.slice(0, m.index) : slice.slice(0, maxLen);
  return cut.trim();
}

function titleCase(text) {
  return text.split(/\s+/).map((w, i) => {
    const lw = w.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lw)) return lw;
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function autoProjectName(details) {
  const text = String(details || '').trim();
  if (!text) return 'Untitled Project';

  if (ARABIC_RE.test(text)) {
    return truncateAtBreak(text, 45) || text.slice(0, 45).trim();
  }

  let short = truncateAtBreak(text, 55) || text.slice(0, 55).trim();
  short = short.replace(/\band\b/gi, '&');
  return titleCase(short);
}

module.exports = { autoProjectName };
