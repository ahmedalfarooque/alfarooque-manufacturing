'use client';

/* Quotation editor — both modes:
   · Quick Quote: add products from the catalogue (price/description
     snapshot, cost model copied for margin visibility)
   · Detailed: blank product costed inline with CostModelEditor
   Autosave (2.5 s idle, draft only) sends the whole document; the
   server recalculates with the same engine and returns totals. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Shell from '@/components/Shell';
import StatusBadge from '@/components/StatusBadge';
import CostModelEditor from '@/components/CostModelEditor';
import { langHelpers, pickL, codeLabel } from '@/lib/i18n';
import { projectStatusBadgeKey } from '@/lib/projectStatus';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { quotationSummary, productCostSummary, r2, scaleFactor, scaleCostLines } from '@/lib/costing';
import { Button, Input, Textarea, Select, Field, Modal, Th, Td } from '@/components/ui';

const DEFAULT_PARAMS = { overheadPct: 10, riskPct: 3, profitMode: 'pct', profitValue: 25, sellingPrice: 0, rounding: 0 };
const HEADER_KEYS = ['customer_id', 'quote_date', 'valid_until', 'output_lang', 'payment_terms',
  'delivery_terms', 'customer_notes', 'internal_notes', 'discount_type', 'discount_value', 'vat_rate'];

function paramsFromRow(p) {
  return {
    overheadPct: p.overhead_pct != null ? Number(p.overhead_pct) : DEFAULT_PARAMS.overheadPct,
    riskPct: p.risk_pct != null ? Number(p.risk_pct) : DEFAULT_PARAMS.riskPct,
    profitMode: p.profit_mode || 'pct',
    profitValue: p.profit_value != null ? Number(p.profit_value) : DEFAULT_PARAMS.profitValue,
    sellingPrice: 0,
    rounding: 0,
  };
}

export default function QuotationEditorPage() {
  const { id } = useParams();
  const [doc, setDoc] = useState(null);            // quotation row
  /* The quotation's own saved output_lang is the master language for
     everything in this editor (header, customer, products, terms,
     buttons/labels, and — downstream — print/PDF/QR) per the language
     spec; it deliberately overrides the app-wide language toggle used
     by every other page, and switches instantly on patchDoc() with no
     refetch since langHelpers() is a pure function of the value. */
  const lang = doc?.output_lang || 'en';
  const { t, tr, trL, formatNumber, formatDate } = langHelpers(lang);
  const [products, setProducts] = useState([]);    // [{...row, lines, cost_params, _open}]
  const [version, setVersion] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState('idle'); // idle|saving|saved|error|conflict
  const [addOpen, setAddOpen] = useState(false);
  const [catQ, setCatQ] = useState('');
  const dCatQ = useDebouncedValue(catQ, 250);
  const [catRows, setCatRows] = useState([]);
  const [custQ, setCustQ] = useState('');
  const dCustQ = useDebouncedValue(custQ, 250);
  const [custRows, setCustRows] = useState([]);
  const [custOpen, setCustOpen] = useState(false);
  const [pickedCustomer, setPickedCustomer] = useState(null); // full bilingual row, for instant re-display on language switch
  const [tabByProduct, setTabByProduct] = useState({});
  const [statusMsg, setStatusMsg] = useState(null);
  const [decision, setDecision] = useState(null);  // 'accept' | 'decline'
  const [decisionReason, setDecisionReason] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ to: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [projectRequest, setProjectRequest] = useState(null);
  const [sendingToProjects, setSendingToProjects] = useState(false);
  const skipNextSave = useRef(true);

  const editable = doc && doc.status === 'draft';

  /* ── Load ── */
  useEffect(() => {
    fetch('/api/quotations/' + id, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d || !d.row) return;
        setDoc(d.row);
        setVersion(d.row.updated_at);
        setProducts((d.products || []).map(p => ({ ...p, cost_params: paramsFromRow(p), _open: false })));
        setProjectRequest(d.projectRequest || null);
        if (d.row.customer) {
          setPickedCustomer(d.row.customer);
          setCustQ(pickL(d.row.customer, 'company_name', d.row.output_lang || 'en') || d.row.customer.company_name || '');
        }
        skipNextSave.current = true;
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* Re-display the customer name in the newly-selected language, instantly
     and with no refetch — but only while the search box isn't actively
     being typed into, so it never clobbers in-progress input. */
  useEffect(() => {
    if (pickedCustomer && !custOpen) setCustQ(trL(pickedCustomer, 'company_name') || pickedCustomer.company_name || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  /* Light polling for just the project-request status (Part 7) — only
     updates projectRequest, never the document/products state, so it
     can't clobber an in-progress edit or the customer search box. */
  useEffect(() => {
    const timer = setInterval(() => {
      fetch('/api/quotations/' + id, { credentials: 'same-origin' })
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setProjectRequest(d.projectRequest || null); })
        .catch(() => {});
    }, 20000);
    return () => clearInterval(timer);
  }, [id]);

  /* ── Catalogue & customer pickers ── */
  useEffect(() => {
    if (!addOpen) return;
    fetch(`/api/catalogue?q=${encodeURIComponent(dCatQ)}&page=1`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] }).then(d => setCatRows(d.rows || [])).catch(() => {});
  }, [dCatQ, addOpen]);

  useEffect(() => {
    if (!custOpen) return;
    fetch(`/api/customers?q=${encodeURIComponent(dCustQ)}&page=1`, { credentials: 'same-origin' })
      .then(r => r.ok ? r.json() : { rows: [] }).then(d => setCustRows(d.rows || [])).catch(() => {});
  }, [dCustQ, custOpen]);

  /* ── Local totals (instant) ── */
  const totals = useMemo(() => {
    if (!doc) return null;
    return quotationSummary(
      products.map(p => {
        let cost = Number(p.total_cost) || 0;
        if (p.lines && p.lines.length) {
          const s = productCostSummary(p.lines, { ...p.cost_params, qty: 1 });
          cost = r2(s.totalCost * (Number(p.qty) || 1));
        }
        return { qty: p.qty, unit_price: p.unit_price, taxable: p.taxable !== false, line_discount: p.line_discount || 0, total_cost: cost };
      }),
      { discountType: doc.discount_type || 'pct', discountValue: doc.discount_value || 0, vatRate: doc.vat_rate != null ? doc.vat_rate : 15 },
    );
  }, [doc, products]);

  /* ── Autosave ── */
  const payload = useMemo(() => {
    if (!doc) return null;
    const header = {};
    HEADER_KEYS.forEach(k => { header[k] = doc[k]; });
    return { header, products: products.map(p => ({ ...p })) };
  }, [doc, products]);
  const debouncedPayload = useDebouncedValue(payload, 2500);

  const save = useCallback(async (p) => {
    if (!p || !editable) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/quotations/${id}/save`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
        body: JSON.stringify({ ...p, version }),
      });
      const d = await res.json().catch(() => ({}));
      if (res.status === 409 && d.error === 'version_conflict') { setSaveState('conflict'); return; }
      if (!res.ok) throw new Error(d.error || t('common.genericError'));
      setVersion(d.version);
      setDirty(false);
      setSaveState('saved');
    } catch (_) { setSaveState('error'); }
  }, [id, version, editable]);

  useEffect(() => {
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (!dirty) return;
    save(debouncedPayload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedPayload]);

  function touch() { setDirty(true); setSaveState('idle'); }
  function patchDoc(patch) { setDoc(d => ({ ...d, ...patch })); touch(); }
  function patchProduct(i, patch) { setProducts(ps => ps.map((p, j) => j === i ? { ...p, ...patch } : p)); touch(); }
  function removeProduct(i) { setProducts(ps => ps.filter((_, j) => j !== i)); touch(); }
  function moveProduct(i, dir) {
    setProducts(ps => {
      const n = [...ps]; const j = i + dir;
      if (j < 0 || j >= n.length) return ps;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
    touch();
  }

  async function addFromCatalogue(c) {
    /* Snapshot the catalogue product incl. its cost model + base dims. */
    let lines = [];
    let params = { ...DEFAULT_PARAMS };
    let dims = {};
    try {
      const res = await fetch('/api/catalogue/' + c.id, { credentials: 'same-origin' });
      const d = res.ok ? await res.json() : null;
      if (d) {
        lines = (d.lines || []).map(l => { const x = { ...l }; delete x.id; delete x.product_id; delete x.created_at; delete x.updated_at; return x; });
        params = { ...DEFAULT_PARAMS, ...(d.row.cost_params || {}) };
        dims = d.row.dimensions || {};
      }
    } catch (_) {}
    setProducts(ps => [...ps, {
      catalogue_product_id: c.id,
      name: c.name, name_en: c.name_en || null, name_ar: c.name_ar || null,
      description: c.description, description_en: c.description_en || null, description_ar: c.description_ar || null,
      unit: c.unit || 'nos', qty: 1,
      unit_price: Number(c.standard_price) || 0,
      taxable: true, line_discount: 0,
      total_cost: Number(c.last_calculated_cost) || 0,
      dimensions: { ...dims }, base_dimensions: { ...dims },
      _baseLines: lines.map(l => ({ ...l })), _basePrice: Number(c.standard_price) || 0,
      cost_params: params, lines, _open: false,
    }]);
    setAddOpen(false); setCatQ('');
    touch();
  }

  /* Dynamic size pricing (spec §8): editing a dimension rescales the
     size-dependent cost lines from the base snapshot and re-derives the
     selling price instantly — no save needed.                          */
  function patchDimension(i, key, value) {
    setProducts(ps => ps.map((p, j) => {
      if (j !== i) return p;
      const dims = { ...(p.dimensions || {}) };
      const v = parseFloat(value);
      if (Number.isFinite(v) && v > 0) dims[key] = v; else delete dims[key];
      const base = p.base_dimensions || {};
      const baseLines = p._baseLines || p.lines;
      /* Per-line formulas: area / perimeter / length / volume / fixed —
         manually-overridden lines keep their values (spec §19). */
      const manualById = new Map(p.lines.map((l, k) => [k, l]));
      const scaled = scaleCostLines(baseLines, base, dims);
      const lines = scaled.map((l, k) => {
        const cur = manualById.get(k);
        return (cur && cur.extra && cur.extra.manual) ? cur : l;
      });
      const next = { ...p, dimensions: dims, _baseLines: baseLines, lines };
      if (lines.length) {
        const s = productCostSummary(lines, { ...p.cost_params, qty: 1 });
        next.unit_price = s.unitPrice;
      } else if (p._basePrice) {
        next.unit_price = r2(p._basePrice * scaleFactor(base, dims));
      }
      return next;
    }));
    touch();
  }

  /* Reset every manual override on a product back to the formula. */
  function resetToFormula(i) {
    setProducts(ps => ps.map((p, j) => {
      if (j !== i) return p;
      const baseLines = (p._baseLines || p.lines).map(l => ({ ...l, extra: { ...(l.extra || {}), manual: false } }));
      const lines = scaleCostLines(baseLines, p.base_dimensions || {}, p.dimensions || {});
      const next = { ...p, _baseLines: baseLines, lines };
      if (lines.length) {
        const s = productCostSummary(lines, { ...p.cost_params, qty: 1 });
        next.unit_price = s.unitPrice;
      }
      return next;
    }));
    touch();
  }

  async function saveAsNewProduct(p) {
    const res = await fetch('/api/catalogue/from-quotation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        source_product_id: p.catalogue_product_id || null,
        name: productField(p, 'name') ? productField(p, 'name') + (lang === 'ar' ? ' - خاص' : ' - Custom') : '',
        description: productField(p, 'description'),
        unit: p.unit, dimensions: p.dimensions || {},
        unit_price: p.unit_price, cost_params: p.cost_params, lines: p.lines,
      }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.code) setStatusMsg(t('quote.savedAsProduct', { code: d.code }));
    else setStatusMsg('⚠ ' + ((d && d.error) || t('common.genericError')));
  }

  function specsChanged(p) {
    if (!p.catalogue_product_id) return false;
    const dimsChanged = JSON.stringify(p.dimensions || {}) !== JSON.stringify(p.base_dimensions || {});
    const priceChanged = p._basePrice != null && Number(p.unit_price) !== Number(p._basePrice);
    return dimsChanged || priceChanged;
  }

  function addDetailed() {
    setProducts(ps => [...ps, {
      catalogue_product_id: null, name: '', description: '', unit: 'nos', qty: 1,
      unit_price: 0, taxable: true, line_discount: 0, total_cost: 0,
      cost_params: { ...DEFAULT_PARAMS }, lines: [], _open: true,
    }]);
    setAddOpen(false);
    touch();
  }

  async function updateExistingProduct(p) {
    const res = await fetch('/api/catalogue/' + p.catalogue_product_id + '/update-from-quotation', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({
        dimensions: p.dimensions || {}, description: p.description,
        unit_price: p.unit_price, cost_params: p.cost_params, lines: p.lines,
      }),
    }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.ok) setStatusMsg(t('quote.productUpdated', { name: pname(p) || '' }));
    else setStatusMsg('⚠ ' + ((d && d.error) || t('common.genericError')));
  }

  /* Spec §9: variants dialog — changed products, Save As New by default. */
  const [variants, setVariants] = useState(null); // null | [{i, choice}]

  async function applyVariantsAndSubmit(items) {
    setVariants(null);
    for (const it of items) {
      const p = products[it.i];
      if (!p) continue;
      if (it.choice === 'new') await saveAsNewProduct(p);
      else if (it.choice === 'update') await updateExistingProduct(p);
    }
    await doStatus('submit', null, true);
  }

  async function doStatus(action, extra, skipVariants) {
    if (action === 'submit' && !skipVariants) {
      const changed = products.map((p, i) => ({ p, i })).filter(x => specsChanged(x.p));
      if (changed.length) {
        setVariants(changed.map(x => ({ i: x.i, choice: 'new' })));
        return;
      }
    }
    if (dirty && editable) await save(payload);
    setStatusMsg(null);
    const res = await fetch(`/api/quotations/${id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ action, ...(extra || {}) }),
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setStatusMsg('⚠ ' + (d.error || t('common.genericError'))); return; }
    setDoc(x => ({ ...x, status: d.status }));
    if (action === 'submit') {
      setStatusMsg(d.status === 'approved' ? t('quote.autoApproved') : t('quote.sentForApproval'));
    }
    setDecision(null); setDecisionReason('');
  }

  async function sendToProjects() {
    if (sendingToProjects || projectRequest) return; // guards accidental double-click
    setSendingToProjects(true);
    setStatusMsg(null);
    const res = await fetch(`/api/quotations/${id}/send-to-projects`, {
      method: 'POST', credentials: 'same-origin',
    }).catch(() => null);
    const d = res ? await res.json().catch(() => ({})) : {};
    setSendingToProjects(false);
    if (!res || !res.ok) { setStatusMsg('⚠ ' + (d.error || t('common.genericError'))); return; }
    setProjectRequest(d.row);
    setStatusMsg(t('quote.sentToProjects'));
  }

  async function clone(kind) {
    const res = await fetch(`/api/quotations/${id}/${kind}`, { method: 'POST', credentials: 'same-origin' }).catch(() => null);
    const d = res && res.ok ? await res.json() : null;
    if (d && d.id) window.location.href = '/quotations/' + d.id;
    else if (d && d.error) setStatusMsg('⚠ ' + d.error);
  }

  if (!doc || !totals) {
    return <Shell active="/quotations"><div className="text-sm text-[#8C8A80]">{t('shell.loading')}</div></Shell>;
  }

  const money = (n) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const custName = (c) => trL(c, 'company_name');

  /* Product name/description are free-text inputs the user edits
     directly (not read-only display), so instead of trL()'s "fall back
     to the other language" behavior, a missing language-specific value
     shows blank rather than the wrong-language text — satisfying "never
     mix languages" for an editable field. Switching output_lang reads/
     writes name_en+name_ar (or description_en/_ar) so both languages'
     text survive independently across language toggles. */
  const AR_RE = /[؀-ۿ]/;
  function productField(p, base) {
    const specific = p[base + (lang === 'ar' ? '_ar' : '_en')];
    if (specific !== undefined && specific !== null && specific !== '') return specific;
    const canonical = p[base] || '';
    if (!canonical) return '';
    return (lang === 'ar') === AR_RE.test(canonical) ? canonical : '';
  }
  function patchProductField(i, base, value) {
    const key = base + (lang === 'ar' ? '_ar' : '_en');
    patchProduct(i, { [key]: value, [base]: value });
  }
  const pname = (p) => productField(p, 'name') || trL(p, 'name');
  const saveLabel = { idle: dirty ? t('quote.unsaved') : '', saving: t('common.saving'), saved: t('quote.saved'), error: '⚠ ' + t('quote.saveError'), conflict: '⚠ ' + t('quote.conflict') }[saveState];

  return (
    <Shell active="/quotations">
      <div className="space-y-4" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
        {/* ── Header bar ── */}
        <div className="glass-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <a href="/quotations" className="text-[#8C8A80] hover:underline text-sm">‹</a>
            <span className="font-semibold" dir="ltr">{doc.quote_number}</span>
            <StatusBadge status={doc.status} />
            {doc.project_id && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#BC6B4E]/10 text-[#BC6B4E]" title={t('quote.projectLocked')}>
                🔒 {t('quote.projectLocked')}
              </span>
            )}
            {doc.entity && <span className="text-[11px] text-[#8C8A80]">{lang === 'ar' ? (doc.entity.name_ar || doc.entity.name_en) : doc.entity.name_en}</span>}
            <span className="text-[11px] text-[#8C8A80]">{saveLabel}</span>
            <div className="flex-1" />
            {editable && <Button onClick={() => doStatus('submit')}>{t('quote.submit')}</Button>}
            {doc.status === 'pending_approval' && (
              <>
                <Button onClick={() => doStatus('approve')}>{t('quote.approve')}</Button>
                <Button variant="danger" onClick={() => doStatus('reject', { reason: window.prompt(t('quote.rejectReason')) || '' })}>{t('quote.sendBack')}</Button>
              </>
            )}
            {['approved', 'sent'].includes(doc.status) && (
              <>
                <Button onClick={() => { setSendForm({ to: (doc.customer && doc.customer.email) || '', subject: '', message: '' }); setSendOpen(true); }}>
                  ✉ {t('quote.sendEmail')}
                </Button>
                <Button variant="ghost" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(window.location.origin + '/q/' + doc.public_token);
                    setStatusMsg(t('quote.linkCopied'));
                  } catch (_) { setStatusMsg(window.location.origin + '/q/' + doc.public_token); }
                }}>🔗 {t('quote.copyLink')}</Button>
                <Button onClick={() => setDecision('accept')}>{t('quote.markAccepted')}</Button>
                <Button variant="danger" onClick={() => setDecision('decline')}>{t('quote.markRejected')}</Button>
              </>
            )}
            {doc.status === 'accepted' && (
              <Button onClick={() => doStatus('contract')}>{t('quote.markContracted')}</Button>
            )}
            {doc.status === 'contracted' && (
              <Button onClick={() => doStatus('start')}>{t('quote.startProject')}</Button>
            )}
            <Button variant="ghost" onClick={() => window.open('/quotations/' + id + '/print?lang=' + (doc.output_lang || 'en'), '_blank')}>
              ⤓ {t('quote.print')}
            </Button>
            {!['draft', 'superseded', 'cancelled'].includes(doc.status) && (
              <Button variant="ghost" onClick={() => clone('revise')}>{t('quote.newRevision')}</Button>
            )}
            <Button variant="ghost" onClick={() => clone('duplicate')}>{t('catalogue.duplicate')}</Button>
          </div>
          {statusMsg && <div className="mt-2 rounded-lg bg-brand-600/10 border border-brand-600/25 px-3 py-2 text-sm">{statusMsg}</div>}

          {/* Header fields */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Field label={t('nav.customers')} className="col-span-2 relative">
              <Input value={custQ} disabled={!editable}
                onFocus={() => setCustOpen(true)}
                onChange={e => { setCustQ(e.target.value); setCustOpen(true); }} />
              {custOpen && editable && custRows.length > 0 && (
                <div className="absolute z-30 mt-1 w-full glass-card bg-white dark:bg-[#1B1B14] shadow-xl max-h-56 overflow-y-auto">
                  {custRows.slice(0, 8).map(c => (
                    <button key={c.id} type="button"
                      onClick={() => { patchDoc({ customer_id: c.id }); setPickedCustomer(c); setCustQ(custName(c)); setCustOpen(false); }}
                      className="w-full text-start px-3 py-2 text-sm hover:bg-[#F1EEE7] dark:hover:bg-white/5 border-b border-[#E5E2DD]/60 dark:border-white/5">
                      {custName(c)} <span className="text-[11px] text-[#8C8A80]" dir="ltr">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </Field>
            <Field label={t('quote.date')}>
              <Input type="date" disabled={!editable} value={doc.quote_date || ''} onChange={e => patchDoc({ quote_date: e.target.value })} />
            </Field>
            <Field label={t('quote.validUntil')}>
              <Input type="date" disabled={!editable} value={doc.valid_until || ''} onChange={e => patchDoc({ valid_until: e.target.value })} />
            </Field>
            <Field label={t('quote.outputLang')}>
              <Select disabled={!editable} value={doc.output_lang || 'en'} onChange={e => patchDoc({ output_lang: e.target.value })}
                options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
            </Field>
            <Field label={t('quote.paymentTerms')} className="col-span-2">
              <Textarea rows={3} placeholder={t('quote.paymentTermsPlaceholder')} disabled={!editable}
                value={doc.payment_terms || ''} onChange={e => patchDoc({ payment_terms: e.target.value })} />
            </Field>
            <Field label={t('quote.deliveryTerms')}>
              <Input disabled={!editable} value={doc.delivery_terms || ''} onChange={e => patchDoc({ delivery_terms: e.target.value })} />
            </Field>
            <Field label={t('quote.customerNotes')}>
              <Input disabled={!editable} value={doc.customer_notes || ''} onChange={e => patchDoc({ customer_notes: e.target.value })} />
            </Field>
          </div>
        </div>

        {/* ── Project Integration (Part 4): only once Status = Started ── */}
        {doc.status === 'started' && (
          <div className="glass-card p-4">
            <div className="font-semibold mb-1">{t('quote.projectIntegration')}</div>
            {projectRequest ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#8C8A80]">{t('quote.sentToProjects')}</span>
                <StatusBadge status={projectStatusBadgeKey(doc.project_status) || 'pr_' + projectRequest.status} />
                {doc.project_id && (
                  <a href={(process.env.NEXT_PUBLIC_PROJECTS_APP_URL || 'https://projects.alfarooque.com') + '/projects/' + doc.project_id}
                    target="_blank" rel="noreferrer" className="text-sm text-brand-600 dark:text-brand-400 hover:underline">
                    ↗ {t('quote.openProject')}
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm text-[#8C8A80]">{t('quote.readyToTransfer')}</span>
                <Button disabled={sendingToProjects} onClick={sendToProjects}>
                  {sendingToProjects ? t('common.saving') : t('quote.sendToProjects')}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1fr,320px] gap-4 items-start">
          {/* ── Products ── */}
          <div className="space-y-3">
            {products.map((p, i) => (
              <div key={i} className="glass-card overflow-hidden">
                <div className="p-3 flex flex-wrap items-center gap-3">
                  <span className="text-[11px] text-[#8C8A80] w-5">{i + 1}.</span>
                  <div className="flex-1 min-w-[180px]">
                    <Input disabled={!editable} value={productField(p, 'name')} placeholder={t('f.name')}
                      onChange={e => patchProductField(i, 'name', e.target.value)} />
                  </div>
                  <Input type="number" step="0.001" disabled={!editable} value={p.qty} className="w-20"
                    onChange={e => patchProduct(i, { qty: e.target.value })} title={t('cost.qty')} />
                  <Input disabled={!editable} value={p.unit || ''} className="w-20"
                    onChange={e => patchProduct(i, { unit: e.target.value })} title={t('f.unit')} />
                  <Input type="number" step="0.01" disabled={!editable} value={p.unit_price} className="w-28"
                    onChange={e => patchProduct(i, { unit_price: e.target.value })} title={t('quote.unitPrice')} />
                  <label className="flex items-center gap-1 text-[12px] text-[#8C8A80]">
                    <input type="checkbox" disabled={!editable} checked={p.taxable !== false}
                      onChange={e => patchProduct(i, { taxable: e.target.checked })} />
                    {t('quote.vat')}
                  </label>
                  <span className="font-semibold whitespace-nowrap w-28 text-end" dir="ltr">
                    {money((Number(p.qty) || 0) * (Number(p.unit_price) || 0) - (Number(p.line_discount) || 0))}
                  </span>
                  {editable && (
                    <span className="flex items-center gap-1 text-[#8C8A80]">
                      <button onClick={() => moveProduct(i, -1)} className="hover:text-inherit">↑</button>
                      <button onClick={() => moveProduct(i, 1)} className="hover:text-inherit">↓</button>
                      <button onClick={() => removeProduct(i)} className="text-[#BC6B4E]">×</button>
                    </span>
                  )}
                  <button onClick={() => patchProduct(i, { _open: !p._open })}
                    className="text-brand-600 dark:text-brand-400 text-sm hover:underline">
                    {p._open ? t('quote.hideCosting') : t('quote.showCosting')}
                  </button>
                </div>

                {/* dimensions — dynamic size pricing */}
                {(Object.keys(p.base_dimensions || {}).length > 0 || Object.keys(p.dimensions || {}).length > 0) && (
                  <div className="px-3 pb-2 flex flex-wrap items-center gap-2 text-[12px]">
                    <span className="text-[#8C8A80]">{t('quote.size')}:</span>
                    {['length', 'width', 'height', 'thickness'].map(k => (
                      <label key={k} className="flex items-center gap-1">
                        <span className="text-[#8C8A80]">{t('dim.' + k)}</span>
                        <Input type="number" step="1" disabled={!editable} dir="ltr"
                          value={(p.dimensions && p.dimensions[k]) ?? ''}
                          onChange={e => patchDimension(i, k, e.target.value)}
                          className="w-20 !py-1" />
                      </label>
                    ))}
                    {specsChanged(p) && (
                      <span className="flex items-center gap-2 ms-2">
                        <span className="text-[#BC6B4E]">{t('quote.specsChanged')}</span>
                        {editable && (
                          <>
                            <button type="button" onClick={() => saveAsNewProduct(p)}
                              className="text-brand-600 dark:text-brand-400 hover:underline">
                              {t('quote.saveAsNewProduct')}
                            </button>
                            {p.catalogue_product_id && (
                              <button type="button" onClick={() => {
                                if (window.confirm(t('quote.updateExistingAsk', { name: pname(p) || '' }))) updateExistingProduct(p);
                              }} className="text-[#8C8A80] hover:underline">
                                {t('quote.updateExisting')}
                              </button>
                            )}
                            <button type="button" onClick={() => resetToFormula(i)} className="text-[#8C8A80] hover:underline">
                              {t('cost.resetFormula')}
                            </button>
                          </>
                        )}
                      </span>
                    )}
                  </div>
                )}

                {/* line description */}
                <div className="px-3 pb-3">
                  <Textarea rows={2} disabled={!editable}
                    placeholder={t('quote.descriptionPlaceholder')}
                    value={productField(p, 'description')}
                    onChange={e => patchProductField(i, 'description', e.target.value)} />
                </div>

                {/* inline costing */}
                {p._open && (
                  <div className="border-t border-[#E5E2DD] dark:border-white/[0.08] p-3 bg-[#F7F5F1]/50 dark:bg-black/10">
                    <CostModelEditor markManual lang={lang}
                      lines={p.lines} setLines={fn => { const next = typeof fn === 'function' ? fn(p.lines) : fn; patchProduct(i, { lines: next }); }}
                      params={p.cost_params} setParams={fn => { const next = typeof fn === 'function' ? fn(p.cost_params) : fn; patchProduct(i, { cost_params: next }); }}
                      tab={tabByProduct[i] || 'material'} setTab={s => setTabByProduct(m => ({ ...m, [i]: s }))}
                    />
                    {editable && p.lines.length > 0 && (
                      <div className="mt-2 text-end">
                        <Button variant="ghost" onClick={() => {
                          const s = productCostSummary(p.lines, { ...p.cost_params, qty: 1 });
                          patchProduct(i, { unit_price: s.unitPrice });
                        }}>{t('quote.useCalculatedPrice')}</Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {editable && (
              <div className="glass-card p-4 flex flex-wrap gap-2">
                <Button onClick={() => setAddOpen(true)}>+ {t('quote.addFromCatalogue')}</Button>
                <Button variant="ghost" onClick={addDetailed}>+ {t('quote.addDetailed')}</Button>
              </div>
            )}
          </div>

          {/* ── Summary ── */}
          <div className="glass-card p-4 xl:sticky xl:top-20 space-y-2 text-sm">
            <div className="font-semibold">{t('quote.summary')}</div>
            <div className="flex justify-between"><span className="text-[#8C8A80]">{t('quote.subtotal')}</span><span dir="ltr">{money(totals.subtotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8C8A80]">{t('quote.discount')}</span>
              <span className="flex items-center gap-1">
                <Select disabled={!editable} value={doc.discount_type || 'pct'} className="w-16 !py-1"
                  onChange={e => patchDoc({ discount_type: e.target.value })}
                  options={[{ value: 'pct', label: '%' }, { value: 'amount', label: t('common.currencyUnit') }]} />
                <Input type="number" step="0.01" disabled={!editable} value={doc.discount_value || 0} className="w-20 !py-1 text-end"
                  onChange={e => patchDoc({ discount_value: e.target.value })} />
                <span className="w-20 text-end" dir="ltr">−{money(totals.discountAmount)}</span>
              </span>
            </div>
            <div className="flex justify-between"><span className="text-[#8C8A80]">{t('quote.netTotal')}</span><span dir="ltr">{money(totals.netTotal)}</span></div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#8C8A80]">{t('quote.vat')}</span>
              <span className="flex items-center gap-1">
                <Input type="number" step="0.1" disabled={!editable} value={doc.vat_rate != null ? doc.vat_rate : 15} className="w-16 !py-1 text-end"
                  onChange={e => patchDoc({ vat_rate: e.target.value })} />%
                <span className="w-20 text-end" dir="ltr">{money(totals.vatAmount)}</span>
              </span>
            </div>
            <div className="rounded-xl bg-brand-600/10 border border-brand-600/25 p-3 flex justify-between items-center">
              <span className="font-semibold">{t('quote.grandTotal')}</span>
              <span className="font-bold text-lg" dir="ltr">{money(totals.grandTotal)}</span>
            </div>
            <div className="border-t border-[#E5E2DD] dark:border-white/[0.08] pt-2 text-[12px] text-[#8C8A80] space-y-1">
              <div className="flex justify-between"><span>{t('quote.internalCost')}</span><span dir="ltr">{money(totals.blendedCost)}</span></div>
              <div className="flex justify-between"><span>{t('cost.profitAmount')}</span><span dir="ltr">{money(totals.profit)}</span></div>
              <div className={'flex justify-between ' + (Number(totals.blendedMarginPct) < 15 ? 'text-[#BC6B4E] font-medium' : '')}>
                <span>{t('quote.blendedMargin')}</span><span>{formatNumber(totals.blendedMarginPct, { maximumFractionDigits: 1 })}%</span>
              </div>
            </div>
            <Field label={t('quote.internalNotes')}>
              <Textarea rows={2} disabled={!editable} value={doc.internal_notes || ''} onChange={e => patchDoc({ internal_notes: e.target.value })} />
            </Field>
          </div>
        </div>
      </div>

      {/* ── Add-from-catalogue modal ── */}
      {addOpen && (
        <Modal title={t('quote.addFromCatalogue')} onClose={() => setAddOpen(false)} wide>
          <Input autoFocus value={catQ} onChange={e => setCatQ(e.target.value)} placeholder={t('common.search')} />
          <div className="mt-2 max-h-80 overflow-y-auto">
            {catRows.map(c => (
              <button key={c.id} type="button" onClick={() => addFromCatalogue(c)}
                className="w-full text-start px-3 py-2.5 hover:bg-[#F1EEE7] dark:hover:bg-white/5 border-b border-[#E5E2DD]/60 dark:border-white/5">
                <div className="flex justify-between gap-3">
                  <span className="text-sm font-medium truncate">{trL(c, 'name')}</span>
                  <span className="text-sm whitespace-nowrap" dir="ltr">{money(c.standard_price)} {t('common.currencyUnit')} / {c.unit}</span>
                </div>
                <div className="text-[11px] text-[#8C8A80]">{codeLabel(t, 'cat', c.category)} · {c.code}</div>
              </button>
            ))}
            {catRows.length === 0 && <div className="py-8 text-center text-sm text-[#8C8A80]">{t('common.noRecords')}</div>}
          </div>
          <div className="pt-3 flex justify-end">
            <Button variant="ghost" onClick={addDetailed}>+ {t('quote.addDetailed')}</Button>
          </div>
        </Modal>
      )}

      {/* ── Send email modal ── */}
      {sendOpen && (
        <Modal title={t('quote.sendEmail')} onClose={() => setSendOpen(false)}>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setSending(true); setStatusMsg(null);
            try {
              const res = await fetch(`/api/quotations/${id}/send`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                body: JSON.stringify(sendForm),
              });
              const d = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(d.error || t('common.genericError'));
              setDoc(x => ({ ...x, status: d.status }));
              setSendOpen(false);
              setStatusMsg(t('quote.sentOk', { to: sendForm.to }));
            } catch (e2) { setStatusMsg('⚠ ' + e2.message); setSendOpen(false); }
            finally { setSending(false); }
          }} className="space-y-3">
            <Field label={t('quote.sendTo')} required>
              <Input type="email" required value={sendForm.to} onChange={e => setSendForm(s => ({ ...s, to: e.target.value }))} dir="ltr" />
            </Field>
            <Field label={t('quote.subject')}>
              <Input value={sendForm.subject} onChange={e => setSendForm(s => ({ ...s, subject: e.target.value }))}
                placeholder={(doc.output_lang === 'ar' ? 'عرض سعر ' : 'Quotation ') + doc.quote_number} />
            </Field>
            <Field label={t('quote.message')}>
              <Textarea value={sendForm.message} onChange={e => setSendForm(s => ({ ...s, message: e.target.value }))} />
            </Field>
            <div className="text-[11px] text-[#8C8A80]">{t('quote.sendNote')}</div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSendOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={sending}>{sending ? t('common.saving') : t('quote.send')}</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Variants dialog (spec §9): Save As New default ── */}
      {variants && (
        <Modal title={t('quote.variantsTitle')} onClose={() => setVariants(null)}>
          <div className="space-y-3">
            <div className="text-sm text-[#8C8A80]">{t('quote.variantsHint')}</div>
            {variants.map((v, k) => {
              const p = products[v.i];
              if (!p) return null;
              return (
                <div key={v.i} className="rounded-lg border border-[#E5E2DD] dark:border-white/[0.1] p-3">
                  <div className="font-medium text-sm mb-2">{pname(p) || '—'}</div>
                  <div className="flex flex-wrap gap-4 text-sm">
                    {[['new', t('quote.saveAsNewProduct')], ['update', t('quote.updateExisting')], ['skip', t('quote.keepQuotationOnly')]].map(([val, label]) => (
                      <label key={val} className={'flex items-center gap-1.5 ' + (val === 'update' && !p.catalogue_product_id ? 'opacity-40' : '')}>
                        <input type="radio" name={'variant-' + v.i} checked={v.choice === val}
                          disabled={val === 'update' && !p.catalogue_product_id}
                          onChange={() => setVariants(vs => vs.map((x, j) => j === k ? { ...x, choice: val } : x))} />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setVariants(null)}>{t('common.cancel')}</Button>
              <Button onClick={() => applyVariantsAndSubmit(variants)}>{t('quote.continueSubmit')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Accept / decline modal ── */}
      {decision && (
        <Modal title={t(decision === 'accept' ? 'quote.markAccepted' : 'quote.markRejected')} onClose={() => setDecision(null)}>
          <Field label={t(decision === 'accept' ? 'quote.winReason' : 'quote.lossReason')}>
            <Textarea value={decisionReason} onChange={e => setDecisionReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" onClick={() => setDecision(null)}>{t('common.cancel')}</Button>
            <Button variant={decision === 'accept' ? 'primary' : 'danger'}
              onClick={() => doStatus(decision === 'accept' ? 'accept' : 'decline', { reason: decisionReason })}>
              {t('common.save')}
            </Button>
          </div>
        </Modal>
      )}
    </Shell>
  );
}
