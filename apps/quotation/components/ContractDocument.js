'use client';

/* ═══════════════════════════════════════════════════════════════════
   ContractDocument — professional, print/PDF-ready contract template.
   Pure presentation: renders entirely from the `contract` prop, so it
   works in the on-screen live preview AND as the page the puppeteer PDF
   engine prints (same component, identical output — the pattern this app
   already uses for quotations). No data fetching, no DB, no side effects.

   Bilingual:
     lang = 'both' → English + Arabic side-by-side (two columns)
     lang = 'en'   → English only
     lang = 'ar'   → Arabic only (RTL)

   A4 page geometry, repeating letterhead/footer and page numbering are
   handled by @page / print CSS so multi-page contracts stay consistent.
   ═══════════════════════════════════════════════════════════════════ */

import { computeSchedule, round2 } from '@/lib/contracts/payments';
import { defaultClauses, fillClause, COMPANY_NAME, COMPANY_NAME_AR } from '@/lib/contracts/defaultClauses';

function money(n, currency) {
  const v = round2(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${v} ${currency}` : v;
}

export default function ContractDocument({ contract = {}, logoSrc = '/logo.png' }) {
  const lang = contract.output_lang || 'both';
  const showEn = lang === 'en' || lang === 'both';
  const showAr = lang === 'ar' || lang === 'both';
  const currency = contract.currency || 'SAR';

  const ctx = {
    contract_number: contract.contract_number || '—',
    contract_date: contract.contract_date || '',
    customer: contract.customer_snapshot?.company_name || contract.customer_name || '—',
    project: contract.project_snapshot?.name || contract.project_name || '—',
    total: money(contract.grand_total, ''),
    currency,
    company: COMPANY_NAME,
  };
  const ctxAr = { ...ctx, company: COMPANY_NAME_AR };

  const clauses = (contract.clauses && contract.clauses.length ? contract.clauses : defaultClauses());
  const schedule = computeSchedule(contract.grand_total || 0, contract.payments || []);
  const bank = contract.bank || contract.bank_account || null;

  const Bi = ({ en, ar, tag: Tag = 'div', className = '' }) => {
    if (lang === 'both') {
      return (
        <div className={'cd-bi ' + className}>
          <Tag className="cd-col cd-en" dir="ltr">{en}</Tag>
          <Tag className="cd-col cd-ar" dir="rtl">{ar}</Tag>
        </div>
      );
    }
    return <Tag className={className} dir={showAr ? 'rtl' : 'ltr'}>{showAr ? ar : en}</Tag>;
  };

  return (
    <div className={'contract-doc lang-' + lang}>
      <style>{CONTRACT_CSS}</style>

      {/* Watermark (behind content, print-safe) */}
      <div className="cd-watermark" aria-hidden="true">
        <img src={logoSrc} alt="" />
      </div>

      {/* Letterhead */}
      <header className="cd-head">
        <div className="cd-head-brand">
          <img className="cd-logo" src={logoSrc} alt="AL FAROOQUE" />
          <div className="cd-head-names">
            {showEn && <div className="cd-company-en">{COMPANY_NAME}</div>}
            {showAr && <div className="cd-company-ar" dir="rtl">{COMPANY_NAME_AR}</div>}
          </div>
        </div>
        <div className="cd-head-meta">
          <div className="cd-doc-type">{lang === 'ar' ? 'عقد' : lang === 'en' ? 'CONTRACT' : 'CONTRACT · عقد'}</div>
          <div className="cd-doc-no">{ctx.contract_number}</div>
          <div className="cd-doc-date">{ctx.contract_date}</div>
        </div>
      </header>
      <div className="cd-rule" />

      {/* Title */}
      <Bi tag="h1" className="cd-title"
        en={contract.title || 'Works Contract'}
        ar={contract.title_ar || 'عقد أعمال'} />

      {/* Parties summary card */}
      <section className="cd-parties">
        <div className="cd-party">
          <Bi en={<span className="cd-lbl">Client</span>} ar={<span className="cd-lbl">العميل</span>} />
          <div className="cd-val">{ctx.customer}</div>
          {contract.customer_snapshot?.contact_person && <div className="cd-sub">{contract.customer_snapshot.contact_person}</div>}
          {contract.customer_snapshot?.phone && <div className="cd-sub" dir="ltr">{contract.customer_snapshot.phone}</div>}
        </div>
        <div className="cd-party">
          <Bi en={<span className="cd-lbl">Project</span>} ar={<span className="cd-lbl">المشروع</span>} />
          <div className="cd-val">{ctx.project}</div>
          {contract.quotation_number && (
            <div className="cd-sub" dir="ltr">
              {(lang === 'ar' ? 'عرض السعر: ' : 'Quotation: ')}{contract.quotation_number}
            </div>
          )}
        </div>
        <div className="cd-party">
          <Bi en={<span className="cd-lbl">Contract Value</span>} ar={<span className="cd-lbl">قيمة العقد</span>} />
          <div className="cd-val" dir="ltr">{money(contract.grand_total, currency)}</div>
        </div>
      </section>

      {/* Clauses */}
      <section className="cd-clauses">
        {clauses.map((c, i) => (
          <div className="cd-clause" key={c.key || i}>
            <Bi tag="h3" className="cd-clause-h"
              en={c.heading} ar={c.heading_ar} />
            <Bi tag="p" className="cd-clause-b"
              en={fillClause(c.body, ctx)} ar={fillClause(c.body_ar, ctxAr)} />
          </div>
        ))}
      </section>

      {/* Payment schedule */}
      {schedule.rows.length > 0 && (
        <section className="cd-payments">
          <Bi tag="h3" className="cd-clause-h" en="Payment Schedule" ar="جدول الدفعات" />
          <table className="cd-pay-table">
            <thead>
              <tr>
                <th>#</th>
                <th>{lang === 'ar' ? 'البند' : lang === 'en' ? 'Milestone' : 'Milestone · البند'}</th>
                <th>{lang === 'ar' ? 'الاستحقاق' : 'Due'}</th>
                <th>%</th>
                <th>{lang === 'ar' ? 'المبلغ' : 'Amount'}</th>
              </tr>
            </thead>
            <tbody>
              {schedule.rows.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{(showAr && !showEn ? (r.label_ar || r.label) : r.label) || '—'}</td>
                  <td>{r.due_condition || r.due_date || '—'}</td>
                  <td dir="ltr">{r.percent != null ? r.percent + '%' : '—'}</td>
                  <td dir="ltr">{money(r.amount, currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{lang === 'ar' ? 'الإجمالي' : 'Total'}</td>
                <td dir="ltr">{money(schedule.allocatedAmount, currency)}</td>
              </tr>
              {!schedule.balanced && (
                <tr className="cd-pay-remaining">
                  <td colSpan={4}>{lang === 'ar' ? 'المتبقي' : 'Remaining'}</td>
                  <td dir="ltr">{money(schedule.remainingAmount, currency)}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </section>
      )}

      {/* Bank details */}
      {bank && (
        <section className="cd-bank">
          <Bi tag="h3" className="cd-clause-h" en="Bank Details" ar="التفاصيل البنكية" />
          <div className="cd-bank-grid" dir="ltr">
            {bank.bank_name && <div><span className="cd-lbl">Bank</span> {bank.bank_name}</div>}
            {bank.account_name && <div><span className="cd-lbl">Account Name</span> {bank.account_name}</div>}
            {bank.account_number && <div><span className="cd-lbl">Account No.</span> {bank.account_number}</div>}
            {bank.iban && <div><span className="cd-lbl">IBAN</span> {bank.iban}</div>}
            {bank.swift && <div><span className="cd-lbl">SWIFT</span> {bank.swift}</div>}
          </div>
        </section>
      )}

      {/* Notes (optional, rich text stored as sanitized HTML) */}
      {(contract.notes_html || contract.notes_html_ar) && (
        <section className="cd-notes">
          <Bi tag="h3" className="cd-clause-h" en="Notes" ar="ملاحظات" />
          {showEn && contract.notes_html && (
            <div className="cd-rich" dir="ltr" dangerouslySetInnerHTML={{ __html: contract.notes_html }} />
          )}
          {showAr && contract.notes_html_ar && (
            <div className="cd-rich" dir="rtl" dangerouslySetInnerHTML={{ __html: contract.notes_html_ar }} />
          )}
        </section>
      )}

      {/* Signatures */}
      <section className="cd-signatures">
        <div className="cd-sign">
          <div className="cd-sign-line" />
          <Bi en={<span>For {COMPANY_NAME}</span>} ar={<span>عن {COMPANY_NAME_AR}</span>} />
        </div>
        <div className="cd-sign">
          <div className="cd-sign-line" />
          <Bi en={<span>For the Client</span>} ar={<span>عن العميل</span>} />
        </div>
      </section>

      <footer className="cd-foot">
        <span>{ctx.contract_number}</span>
        <span>{lang === 'ar' ? COMPANY_NAME_AR : COMPANY_NAME}</span>
      </footer>
    </div>
  );
}

/* Scoped, print-first CSS. Colours reuse the app's teal system so the
   contract matches the rest of the platform; @page + running header/
   footer keep multi-page output consistent. */
const CONTRACT_CSS = `
.contract-doc{ --cd-ink:#122A30; --cd-mut:#5E7579; --cd-teal:#0C93AE; --cd-line:#D9E4E6;
  position:relative; background:#fff; color:var(--cd-ink); font-size:12px; line-height:1.6;
  padding:28px 32px 48px; max-width:820px; margin:0 auto; }
.cd-watermark{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  pointer-events:none; opacity:.05; z-index:0; }
.cd-watermark img{ width:60%; max-width:420px; }
.contract-doc>*:not(.cd-watermark){ position:relative; z-index:1; }
.cd-head{ display:flex; align-items:flex-start; justify-content:space-between; gap:16px; }
.cd-head-brand{ display:flex; align-items:center; gap:12px; }
.cd-logo{ height:52px; width:auto; object-fit:contain; }
.cd-company-en{ font-weight:800; font-size:16px; letter-spacing:.02em; }
.cd-company-ar{ font-weight:700; font-size:15px; color:var(--cd-mut); }
.cd-head-meta{ text-align:right; }
.cd-doc-type{ font-weight:800; color:var(--cd-teal); letter-spacing:.08em; font-size:11px; }
.cd-doc-no{ font-weight:700; font-size:14px; }
.cd-doc-date{ color:var(--cd-mut); font-size:11px; }
.cd-rule{ height:3px; background:linear-gradient(90deg,var(--cd-teal),#6FE0F2); border-radius:3px; margin:10px 0 18px; }
.cd-title{ text-align:center; font-size:18px; font-weight:800; margin:0 0 16px; }
.cd-parties{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:18px; }
.cd-party{ border:1px solid var(--cd-line); border-radius:10px; padding:10px 12px; }
.cd-lbl{ display:block; font-size:9px; text-transform:uppercase; letter-spacing:.08em; color:var(--cd-mut); }
.cd-val{ font-weight:700; font-size:13px; margin-top:2px; }
.cd-sub{ color:var(--cd-mut); font-size:11px; }
.cd-clause{ margin-bottom:12px; break-inside:avoid; }
.cd-clause-h{ font-size:12px; font-weight:800; margin:0 0 3px; color:var(--cd-teal); }
.cd-clause-b{ margin:0; text-align:justify; }
.cd-bi{ display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.cd-bi .cd-ar{ text-align:right; }
.cd-pay-table{ width:100%; border-collapse:collapse; margin-top:6px; font-size:11px; }
.cd-pay-table th{ background:#F0F5F6; text-align:left; padding:6px 8px; border:1px solid var(--cd-line); font-size:9px; text-transform:uppercase; letter-spacing:.06em; color:var(--cd-mut); }
.cd-pay-table td{ padding:6px 8px; border:1px solid var(--cd-line); }
.cd-pay-table tfoot td{ font-weight:800; background:#F7FAFB; }
.cd-pay-remaining td{ color:var(--cd-teal); }
.cd-bank-grid{ display:grid; grid-template-columns:1fr 1fr; gap:4px 18px; margin-top:4px; }
.cd-bank-grid .cd-lbl{ display:inline; margin-right:6px; }
.cd-rich{ margin-top:4px; }
.cd-signatures{ display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-top:40px; break-inside:avoid; }
.cd-sign-line{ border-top:1px solid var(--cd-ink); margin-bottom:6px; height:36px; }
.cd-foot{ position:absolute; left:32px; right:32px; bottom:18px; display:flex; justify-content:space-between;
  color:var(--cd-mut); font-size:9px; border-top:1px solid var(--cd-line); padding-top:6px; }
@media print{
  @page{ size:A4; margin:14mm; }
  .contract-doc{ padding:0; max-width:none; }
  .cd-foot{ position:fixed; }
  .cd-clause, .cd-signatures, .cd-party{ break-inside:avoid; }
}
`;
