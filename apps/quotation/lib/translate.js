'use strict';

/* Offline EN↔AR auto-translation for product/material/supplier names and
   short descriptions. Dictionary-driven (wood/steel/aluminium industry
   vocabulary) with word-by-word fallback: known words are translated,
   unknown words pass through unchanged (brand names, codes, numbers stay
   as-is — e.g. "Premium MDF Door" → "باب MDF فاخر"). Deterministic, no
   network, no API key. Users can always edit the result manually; both
   versions are stored permanently. Server-side (API prepare hooks) and
   client-side (Translate buttons) share this module.                    */

const PAIRS = [
  // products / assemblies
  ['door', 'باب'], ['doors', 'أبواب'], ['window', 'نافذة'], ['windows', 'نوافذ'],
  ['kitchen', 'مطبخ'], ['cabinet', 'خزانة'], ['cupboard', 'دولاب'], ['wardrobe', 'دولاب ملابس'],
  ['table', 'طاولة'], ['chair', 'كرسي'], ['chairs', 'كراسي'], ['sofa', 'كنبة'], ['bed', 'سرير'],
  ['desk', 'مكتب'], ['shelf', 'رف'], ['shelves', 'أرفف'], ['counter', 'كاونتر'], ['reception', 'استقبال'],
  ['partition', 'قاطع'], ['cladding', 'تكسية'], ['pergola', 'برجولا'], ['gate', 'بوابة'],
  ['frame', 'إطار'], ['jamb', 'حلق'], ['skirting', 'نعلة'], ['curtain', 'ستارة'], ['curtains', 'ستائر'],
  ['drawer', 'درج'], ['drawers', 'أدراج'], ['handle', 'مسكة'], ['hinge', 'مفصلة'], ['lock', 'قفل'],
  ['screw', 'برغي'], ['screws', 'براغي'],
  // materials
  ['wood', 'خشب'], ['wooden', 'خشبي'], ['plywood', 'بلايوود'], ['veneer', 'قشرة'],
  ['solid', 'صلب'], ['teak', 'تيك'], ['oak', 'بلوط'], ['beech', 'زان'], ['walnut', 'جوز'],
  ['steel', 'حديد'], ['aluminium', 'ألمنيوم'], ['aluminum', 'ألمنيوم'], ['glass', 'زجاج'],
  ['marble', 'رخام'], ['fabric', 'قماش'], ['leather', 'جلد'], ['foam', 'إسفنج'],
  ['paint', 'دهان'], ['painted', 'مدهون'], ['lacquer', 'لاكيه'], ['melamine', 'ميلامين'],
  ['laminate', 'فورمايكا'], ['chipboard', 'خشب مضغوط'], ['board', 'لوح'], ['sheet', 'لوح'],
  ['stainless', 'ستانلس'], ['galvanized', 'مجلفن'],
  // qualifiers
  ['premium', 'فاخر'], ['luxury', 'فاخر'], ['standard', 'قياسي'], ['custom', 'حسب الطلب'],
  ['interior', 'داخلي'], ['exterior', 'خارجي'], ['internal', 'داخلي'], ['external', 'خارجي'],
  ['fire', 'حريق'], ['rated', 'مقاوم'], ['fireproof', 'مقاوم للحريق'], ['waterproof', 'مقاوم للماء'],
  ['sliding', 'سحاب'], ['flush', 'مسطح'], ['hotel', 'فندقي'], ['office', 'مكتبي'], ['villa', 'فيلا'],
  ['double', 'مزدوج'], ['single', 'مفرد'], ['large', 'كبير'], ['small', 'صغير'],
  ['white', 'أبيض'], ['black', 'أسود'], ['brown', 'بني'], ['grey', 'رمادي'], ['gray', 'رمادي'],
  ['with', 'مع'], ['without', 'بدون'], ['and', 'و'], ['new', 'جديد'], ['set', 'طقم'],
  // work / services
  ['supply', 'توريد'], ['installation', 'تركيب'], ['install', 'تركيب'], ['fabrication', 'تصنيع'],
  ['manufacturing', 'تصنيع'], ['carpentry', 'نجارة'], ['finishing', 'تشطيب'], ['polish', 'تلميع'],
  ['transport', 'نقل'], ['delivery', 'توصيل'], ['maintenance', 'صيانة'], ['design', 'تصميم'],
  ['works', 'أعمال'], ['work', 'عمل'], ['project', 'مشروع'],
];

const EN2AR = new Map(PAIRS.map(([e, a]) => [e, a]));
const AR2EN = new Map(PAIRS.map(([e, a]) => [a, e]));

function hasArabic(s) { return /[؀-ۿ]/.test(String(s || '')); }

function titleCase(w) { return w ? w.charAt(0).toUpperCase() + w.slice(1) : w; }

/* English noun phrases run adjective→noun ("Premium MDF Door") while
   Arabic runs noun→qualifiers ("باب MDF فاخر"), so the most reliable
   dictionary-level heuristic is: translate word-by-word, then REVERSE
   the word order. Verified: "Premium MDF Door" → "باب MDF فاخر",
   "باب خشب" → "Wood Door", "دولاب مطبخ فاخر" → "Luxury Kitchen Cupboard". */
function enToAr(text) {
  const words = String(text).trim().split(/\s+/);
  const out = words.map(w => {
    const key = w.toLowerCase().replace(/[^\w-]/g, '');
    return EN2AR.get(key) || w;
  });
  return out.reverse().join(' ');
}

function arToEn(text) {
  const words = String(text).trim().split(/\s+/);
  const out = words.map(w => {
    const key = w.replace(/[،,.:؛]/g, '');
    const hit = AR2EN.get(key);
    return hit ? titleCase(hit) : w;
  });
  return out.reverse().join(' ');
}

/** translate(text, toLang) — toLang 'ar' | 'en'. Returns '' for empty. */
function translate(text, toLang) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (toLang === 'ar') return hasArabic(s) ? s : enToAr(s);
  return hasArabic(s) ? arToEn(s) : s;
}

/* Fill the missing half of an {name_en, name_ar}-style pair in a row
   object. Mutates + returns the row. Used by API create/update hooks. */
function autofillPair(row, enKey, arKey) {
  const en = row[enKey], ar = row[arKey];
  if (en && !ar) row[arKey] = translate(en, 'ar');
  else if (ar && !en) row[enKey] = translate(ar, 'en');
  return row;
}

module.exports = { translate, autofillPair, hasArabic };
