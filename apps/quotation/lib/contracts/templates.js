/* ═══════════════════════════════════════════════════════════════════
   Contract template library — PURE data, no DB.
   Each template seeds a new contract's clauses. All templates start from
   the professional DEFAULT_CLAUSES and specialise the Scope-of-Work +
   Technical-Specifications wording for the division/engagement type, so
   ~90-95% of the contract is still auto-generated. Every clause stays
   editable per-contract after seeding.

   The DB persists the chosen clauses on the contract row (qt_contracts.
   clauses JSONB) — these templates are just the starting content, so
   they need no table of their own to function (a user-saved "custom
   template" can be stored via the same repo when desired).
   ═══════════════════════════════════════════════════════════════════ */

import { DEFAULT_CLAUSES } from './defaultClauses';

/* Build a clause set = default clauses with a specialised scope body and
   an inserted Technical Specifications clause after Scope of Work. */
function withSpecialisation(scopeEn, scopeAr, specEn, specAr) {
  const out = [];
  DEFAULT_CLAUSES.forEach(c => {
    if (c.key === 'scope') {
      out.push({ ...c, body: scopeEn, body_ar: scopeAr });
      out.push({
        key: 'tech_spec',
        heading: '2a. Technical Specifications',
        heading_ar: '٢أ. المواصفات الفنية',
        body: specEn,
        body_ar: specAr,
      });
    } else {
      out.push({ ...c });
    }
  });
  return out.map((c, i) => ({ ...c, sort: i }));
}

const GENERIC_SPEC_EN = 'All materials, finishes, dimensions and quantities shall conform to the approved quotation, drawings and technical specifications. Any item not expressly included is excluded.';
const GENERIC_SPEC_AR = 'تلتزم جميع المواد والتشطيبات والأبعاد والكميات بعرض السعر والرسومات والمواصفات الفنية المعتمدة. ويُستثنى أي بند غير مدرج صراحةً.';

export const CONTRACT_TEMPLATES = [
  {
    key: 'general', name: 'General Contract (Default)', name_ar: 'عقد عام (افتراضي)', isDefault: true,
    clauses: DEFAULT_CLAUSES.map((c, i) => ({ ...c, sort: i })),
  },
  {
    key: 'wood', name: 'Wood Works', name_ar: 'أعمال الخشب',
    clauses: withSpecialisation(
      'The Company shall manufacture, supply and install the wood works (joinery, doors, panelling, furniture and related fittings) for "{{project}}" per the approved quotation, drawings and finish schedule.',
      'تلتزم الشركة بتصنيع وتوريد وتركيب أعمال الخشب (النجارة والأبواب والكسوات والأثاث والملحقات) للمشروع "{{project}}" وفقاً لعرض السعر والرسومات وجدول التشطيبات المعتمد.',
      'Timber species, thickness, veneer/laminate, edge banding, ironmongery and finish shall match the approved samples. Moisture content and fire ratings (where specified) shall comply with the project requirements.',
      'تتوافق نوعية الأخشاب والسماكة والقشرة/اللامينيت وشريط الحواف والإكسسوارات والتشطيب مع العينات المعتمدة، مع مطابقة نسبة الرطوبة ومقاومة الحريق (عند الاشتراط) لمتطلبات المشروع.'),
  },
  {
    key: 'steel', name: 'Steel Works', name_ar: 'أعمال الحديد',
    clauses: withSpecialisation(
      'The Company shall fabricate, supply and install the steel works (structures, railings, gates, platforms and related metalwork) for "{{project}}" per the approved quotation and shop drawings.',
      'تلتزم الشركة بتصنيع وتوريد وتركيب الأعمال الحديدية (الهياكل والدرابزينات والبوابات والمنصات والأعمال المعدنية) للمشروع "{{project}}" وفقاً لعرض السعر والرسومات التنفيذية المعتمدة.',
      'Steel grade, section sizes, welding, galvanising/coating system and finish shall conform to the approved specifications and applicable codes.',
      'تتوافق درجة الحديد والمقاسات واللحام ونظام الجلفنة/الطلاء والتشطيب مع المواصفات المعتمدة والأكواد المعمول بها.'),
  },
  {
    key: 'fire_doors', name: 'Fire Rated Doors', name_ar: 'أبواب مقاومة للحريق',
    clauses: withSpecialisation(
      'The Company shall supply and install certified fire-rated door sets (leaf, frame, ironmongery and accessories) for "{{project}}" per the approved quotation and door schedule.',
      'تلتزم الشركة بتوريد وتركيب مجموعات الأبواب المقاومة للحريق المعتمدة (الدرفة والحلق والإكسسوارات) للمشروع "{{project}}" وفقاً لعرض السعر وجدول الأبواب المعتمد.',
      'Door sets shall carry a valid fire-rating certificate for the specified rating (e.g. 60/90/120 minutes) and be installed strictly per the certification and Civil Defense requirements.',
      'تحمل مجموعات الأبواب شهادة مقاومة حريق سارية للتصنيف المحدد (مثل ٦٠/٩٠/١٢٠ دقيقة) وتُركّب وفق الاعتماد ومتطلبات الدفاع المدني.'),
  },
  {
    key: 'aluminium', name: 'Aluminium Works', name_ar: 'أعمال الألمنيوم',
    clauses: withSpecialisation(
      'The Company shall fabricate, supply and install the aluminium works (façades, windows, doors, curtain walls and cladding) for "{{project}}" per the approved quotation and shop drawings.',
      'تلتزم الشركة بتصنيع وتوريد وتركيب أعمال الألمنيوم (الواجهات والنوافذ والأبواب والحوائط الستائرية والكسوات) للمشروع "{{project}}" وفقاً لعرض السعر والرسومات التنفيذية المعتمدة.',
      'Aluminium system, glass type/thickness, thermal break, gaskets and powder-coat/anodised finish shall conform to the approved specifications and performance requirements (wind load, water/air tightness).',
      'يتوافق نظام الألمنيوم ونوع/سماكة الزجاج والفاصل الحراري والحشوات والتشطيب (الطلاء الحراري/الأنودايز) مع المواصفات المعتمدة ومتطلبات الأداء (حمل الرياح وإحكام الماء والهواء).'),
  },
  {
    key: 'supply_only', name: 'Supply Only', name_ar: 'توريد فقط',
    clauses: withSpecialisation(
      'The Company shall manufacture and supply (delivery only, without installation) the items for "{{project}}" per the approved quotation. Installation, if required, is under a separate agreement.',
      'تلتزم الشركة بتصنيع وتوريد (التسليم فقط دون تركيب) الأصناف للمشروع "{{project}}" وفقاً لعرض السعر المعتمد. ويكون التركيب، إن لزم، بموجب اتفاق منفصل.',
      GENERIC_SPEC_EN, GENERIC_SPEC_AR),
  },
  {
    key: 'supply_install', name: 'Supply & Installation', name_ar: 'توريد وتركيب',
    clauses: withSpecialisation(
      'The Company shall manufacture, supply and install the works for "{{project}}" per the approved quotation, drawings and specifications, including delivery to site and installation.',
      'تلتزم الشركة بتصنيع وتوريد وتركيب الأعمال للمشروع "{{project}}" وفقاً لعرض السعر والرسومات والمواصفات المعتمدة، بما يشمل التوصيل للموقع والتركيب.',
      GENERIC_SPEC_EN, GENERIC_SPEC_AR),
  },
  {
    key: 'maintenance', name: 'Maintenance', name_ar: 'صيانة',
    clauses: withSpecialisation(
      'The Company shall provide the maintenance services described for "{{project}}" per the approved quotation, including scheduled visits and corrective works within the agreed scope.',
      'تلتزم الشركة بتقديم خدمات الصيانة الموضحة للمشروع "{{project}}" وفقاً لعرض السعر المعتمد، بما يشمل الزيارات الدورية والأعمال التصحيحية ضمن النطاق المتفق عليه.',
      'Response times, visit frequency, spare-parts handling and exclusions shall be as set out in the approved scope. Consumables and parts outside scope are billed separately.',
      'تكون أوقات الاستجابة وتكرار الزيارات والتعامل مع قطع الغيار والاستثناءات وفق النطاق المعتمد. وتُحتسب المواد الاستهلاكية والقطع خارج النطاق بشكل منفصل.'),
  },
  {
    key: 'custom', name: 'Custom Template', name_ar: 'قالب مخصص',
    clauses: DEFAULT_CLAUSES.map((c, i) => ({ ...c, sort: i })),
  },
];

export function getTemplate(key) {
  return CONTRACT_TEMPLATES.find(t => t.key === key) || CONTRACT_TEMPLATES[0];
}

/* Deep-copy a template's clauses so the seeded contract is independent. */
export function templateClauses(key) {
  return getTemplate(key).clauses.map(c => ({ ...c }));
}
