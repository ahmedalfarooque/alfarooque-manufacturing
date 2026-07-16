/* ═══════════════════════════════════════════════════════════════════
   Default professional contract clauses (EN + AR) — PURE data, no DB.

   These populate a new contract automatically so ~90–95% of contracts
   need no manual clause writing; users normally only edit customer,
   project, and payment details. Each clause is editable/removable in the
   contract editor. Text is generic commercial boilerplate for a Saudi
   works/manufacturing contract and should be reviewed by the company's
   counsel before first production use — it is a starting template, not
   legal advice.

   Placeholders ({{customer}}, {{project}}, {{contract_number}},
   {{contract_date}}, {{total}}, {{currency}}, {{company}}) are filled by
   the contract renderer from the contract/customer/project data.
   ═══════════════════════════════════════════════════════════════════ */

export const COMPANY_NAME = 'AL FAROOQUE Industries';
export const COMPANY_NAME_AR = 'شركة الفاروق للصناعات';

export const DEFAULT_CLAUSES = [
  {
    key: 'parties',
    heading: '1. Parties',
    heading_ar: '١. أطراف العقد',
    body: 'This Contract ({{contract_number}}) is made on {{contract_date}} between {{company}} ("the Company") and {{customer}} ("the Client") for the works described below.',
    body_ar: 'أُبرم هذا العقد ({{contract_number}}) بتاريخ {{contract_date}} بين {{company}} ("الشركة") و{{customer}} ("العميل") بخصوص الأعمال الموضحة أدناه.',
  },
  {
    key: 'scope',
    heading: '2. Scope of Work',
    heading_ar: '٢. نطاق العمل',
    body: 'The Company shall design, manufacture, supply and/or install the works detailed for the project "{{project}}" in accordance with the approved quotation, drawings and specifications, which form an integral part of this Contract.',
    body_ar: 'تلتزم الشركة بتصميم وتصنيع وتوريد و/أو تركيب الأعمال المفصّلة للمشروع "{{project}}" وفقاً لعرض السعر المعتمد والرسومات والمواصفات، والتي تُعد جزءاً لا يتجزأ من هذا العقد.',
  },
  {
    key: 'price',
    heading: '3. Contract Price',
    heading_ar: '٣. قيمة العقد',
    body: 'The total contract price is {{total}} {{currency}}, inclusive of the works described in the Scope of Work. Prices are fixed unless varied by a written change order agreed by both parties.',
    body_ar: 'تبلغ القيمة الإجمالية للعقد {{total}} {{currency}}، شاملةً الأعمال الموضحة في نطاق العمل. الأسعار ثابتة ما لم يتم تعديلها بأمر تغيير خطي متفق عليه بين الطرفين.',
  },
  {
    key: 'payment',
    heading: '4. Payment Terms',
    heading_ar: '٤. شروط الدفع',
    body: 'Payments shall be made according to the payment schedule set out in this Contract. Invoices are due within the agreed period from the invoice date. The Company reserves the right to suspend works for overdue payments.',
    body_ar: 'تُسدد الدفعات وفقاً لجدول الدفعات المبيّن في هذا العقد. تُستحق الفواتير خلال المدة المتفق عليها من تاريخ الفاتورة. وتحتفظ الشركة بالحق في تعليق الأعمال في حال تأخر السداد.',
  },
  {
    key: 'delivery',
    heading: '5. Delivery & Timeline',
    heading_ar: '٥. التسليم والجدول الزمني',
    body: 'The Company shall use reasonable endeavours to complete the works within the agreed timeline. Delivery dates are subject to timely approvals, site readiness, and receipt of due payments from the Client.',
    body_ar: 'تبذل الشركة العناية المعقولة لإنجاز الأعمال ضمن الجدول الزمني المتفق عليه. وتخضع مواعيد التسليم للحصول على الموافقات في وقتها وجاهزية الموقع واستلام الدفعات المستحقة من العميل.',
  },
  {
    key: 'variations',
    heading: '6. Variations & Change Orders',
    heading_ar: '٦. التغييرات وأوامر التعديل',
    body: 'Any change to the scope, materials or specifications must be agreed in writing and may affect the price and timeline. No verbal instruction shall bind the Company.',
    body_ar: 'يجب الاتفاق كتابياً على أي تغيير في النطاق أو المواد أو المواصفات، وقد يؤثر ذلك على السعر والجدول الزمني. ولا تلتزم الشركة بأي تعليمات شفهية.',
  },
  {
    key: 'warranty',
    heading: '7. Warranty',
    heading_ar: '٧. الضمان',
    body: 'The Company warrants its workmanship against manufacturing defects for the agreed warranty period from the date of delivery. The warranty excludes misuse, unauthorised modification, normal wear, and damage caused by third parties.',
    body_ar: 'تضمن الشركة جودة تنفيذها ضد عيوب التصنيع خلال فترة الضمان المتفق عليها من تاريخ التسليم. ولا يشمل الضمان سوء الاستخدام أو التعديل غير المصرّح به أو التآكل الطبيعي أو الأضرار الناتجة عن الغير.',
  },
  {
    key: 'liability',
    heading: '8. Liability',
    heading_ar: '٨. المسؤولية',
    body: "The Company's total liability under this Contract shall not exceed the contract price. The Company shall not be liable for indirect or consequential losses.",
    body_ar: 'لا تتجاوز المسؤولية الإجمالية للشركة بموجب هذا العقد قيمة العقد. ولا تتحمل الشركة أي مسؤولية عن الأضرار غير المباشرة أو التبعية.',
  },
  {
    key: 'force_majeure',
    heading: '9. Force Majeure',
    heading_ar: '٩. القوة القاهرة',
    body: 'Neither party shall be liable for delay or failure to perform caused by events beyond its reasonable control, including acts of God, government action, or supply disruptions.',
    body_ar: 'لا يتحمل أي من الطرفين المسؤولية عن التأخير أو الإخفاق في التنفيذ الناتج عن أحداث خارجة عن إرادته المعقولة، بما في ذلك القوة القاهرة أو إجراءات الجهات الحكومية أو انقطاع سلاسل التوريد.',
  },
  {
    key: 'termination',
    heading: '10. Termination',
    heading_ar: '١٠. إنهاء العقد',
    body: 'Either party may terminate this Contract for material breach that remains uncured after written notice. Upon termination, the Client shall pay for all works completed and materials procured up to the termination date.',
    body_ar: 'يجوز لأي من الطرفين إنهاء هذا العقد في حال الإخلال الجوهري الذي لم يُعالَج بعد إشعار خطي. وعند الإنهاء، يلتزم العميل بسداد قيمة جميع الأعمال المنجزة والمواد المشتراة حتى تاريخ الإنهاء.',
  },
  {
    key: 'law',
    heading: '11. Governing Law & Disputes',
    heading_ar: '١١. القانون الحاكم وتسوية النزاعات',
    body: 'This Contract is governed by the laws of the Kingdom of Saudi Arabia. Disputes shall be settled amicably; failing that, they shall be referred to the competent courts of the Kingdom of Saudi Arabia.',
    body_ar: 'يخضع هذا العقد لأنظمة المملكة العربية السعودية. وتُسوّى النزاعات ودياً، وإذا تعذّر ذلك تُحال إلى المحاكم المختصة في المملكة العربية السعودية.',
  },
  {
    key: 'general',
    heading: '12. General Provisions',
    heading_ar: '١٢. أحكام عامة',
    body: 'This Contract, together with the quotation and its annexes, constitutes the entire agreement between the parties and supersedes all prior discussions. Any amendment must be in writing and signed by both parties.',
    body_ar: 'يُشكّل هذا العقد، مع عرض السعر وملحقاته، كامل الاتفاق بين الطرفين ويلغي كل ما سبقه من مناقشات. ويجب أن يكون أي تعديل خطياً وموقعاً من الطرفين.',
  },
];

/* Return a deep copy with a sort order — used when seeding a new contract
   so the stored clauses are independent of this template (users can edit
   them per-contract without affecting the defaults). */
export function defaultClauses() {
  return DEFAULT_CLAUSES.map((c, i) => ({ ...c, sort: i }));
}

/* Fill {{placeholders}} in a clause body from a context object. */
export function fillClause(text, ctx = {}) {
  return String(text || '').replace(/\{\{(\w+)\}\}/g, (_, k) => (ctx[k] != null ? String(ctx[k]) : ''));
}
