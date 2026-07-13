'use strict';

/* Phase-5 reports, localized. GET
   /api/reports/{slug}?from&to&entity&lang=en|ar&format=json|xlsx|csv
   Headers follow ?lang=; stored text values (names, customers) are
   translated to the requested language so the whole report reads in one
   language (single-language data model).                              */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { buildXlsx, xlsxResponse, csvResponse } = require('@/lib/sheets');
const { r2 } = require('@/lib/costing');
const { translate, hasArabic } = require('@/lib/translate');

export const runtime = 'nodejs';

function range(url) {
  const from = url.searchParams.get('from') || new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const to = url.searchParams.get('to') || new Date().toISOString().slice(0, 10);
  return { from, to };
}
const C = (key, en, ar, textual) => ({ key, en, ar, textual: !!textual });

async function quotationBase(sb, url) {
  const { from, to } = range(url);
  const entity = url.searchParams.get('entity');
  let q = sb.from('qt_quotations')
    .select('id, quote_number, status, quote_date, valid_until, subtotal, discount_amount, net_total, vat_rate, vat_amount, grand_total, total_cost, blended_margin_pct, won_lost_reason, entity:qt_entities(code), customer:customers(company_name, company_name_en, company_name_ar)')
    .is('deleted_at', null).gte('quote_date', from).lte('quote_date', to)
    .not('status', 'in', '(superseded)').order('quote_date', { ascending: false }).limit(10000);
  if (entity) q = q.eq('entity_id', entity);
  const { data } = await q;
  return (data || []).map(r => ({
    ...r,
    entity_code: r.entity ? r.entity.code : '',
    customer_name: r.customer ? r.customer.company_name : '',
    customer_name_en: r.customer ? r.customer.company_name_en : null,
    customer_name_ar: r.customer ? r.customer.company_name_ar : null,
    profit: r2(Number(r.net_total) - Number(r.total_cost)),
  }));
}

const REPORTS = {
  'quotation-register': {
    columns: [C('quote_number', 'Number', 'الرقم'), C('entity_code', 'Entity', 'المنشأة'),
      C('customer_name', 'Customer', 'العميل', true), C('quote_date', 'Date', 'التاريخ'),
      C('status', 'Status', 'الحالة'), C('subtotal', 'Subtotal', 'المجموع'),
      C('discount_amount', 'Discount', 'الخصم'), C('net_total', 'Net', 'الصافي'),
      C('vat_amount', 'VAT', 'الضريبة'), C('grand_total', 'Grand Total', 'الإجمالي'),
      C('blended_margin_pct', 'Margin %', 'الهامش ٪')],
    run: quotationBase,
  },
  'sales-by-customer': {
    columns: [C('customer_name', 'Customer', 'العميل', true), C('count', 'Quotations', 'عدد العروض'),
      C('accepted', 'Accepted', 'المقبول'), C('quoted', 'Quoted (SAR)', 'المعروض (ر.س)'),
      C('won', 'Won (SAR)', 'المكسوب (ر.س)'), C('win_rate', 'Win Rate %', 'نسبة الفوز ٪')],
    run: async (sb, url) => {
      const rows = await quotationBase(sb, url);
      const by = new Map();
      for (const r of rows) {
        const k = r.customer_name || '—';
        const o = by.get(k) || { customer_name: k, count: 0, accepted: 0, quoted: 0, won: 0 };
        o.customer_name_en = o.customer_name_en || r.customer_name_en;
        o.customer_name_ar = o.customer_name_ar || r.customer_name_ar;
        o.count++; o.quoted = r2(o.quoted + Number(r.grand_total));
        if (r.status === 'accepted') { o.accepted++; o.won = r2(o.won + Number(r.grand_total)); }
        by.set(k, o);
      }
      return [...by.values()].map(o => ({ ...o, win_rate: o.count ? r2(o.accepted / o.count * 100) : 0 }))
        .sort((a, b) => b.quoted - a.quoted);
    },
  },
  'profit-margin': {
    columns: [C('quote_number', 'Number', 'الرقم'), C('customer_name', 'Customer', 'العميل', true),
      C('status', 'Status', 'الحالة'), C('net_total', 'Net', 'الصافي'), C('total_cost', 'Cost', 'التكلفة'),
      C('profit', 'Profit', 'الربح'), C('blended_margin_pct', 'Margin %', 'الهامش ٪')],
    run: async (sb, url) => (await quotationBase(sb, url)).sort((a, b) => (a.blended_margin_pct || 0) - (b.blended_margin_pct || 0)),
  },
  'vat-summary': {
    columns: [C('month', 'Month', 'الشهر'), C('entity_code', 'Entity', 'المنشأة'),
      C('net_total', 'Net Sales', 'صافي المبيعات'), C('vat_amount', 'Output VAT', 'ضريبة المخرجات'),
      C('grand_total', 'Gross', 'الإجمالي')],
    run: async (sb, url) => {
      const rows = (await quotationBase(sb, url)).filter(r => ['accepted', 'sent', 'approved'].includes(r.status));
      const by = new Map();
      for (const r of rows) {
        const k = String(r.quote_date).slice(0, 7) + '|' + r.entity_code;
        const o = by.get(k) || { month: String(r.quote_date).slice(0, 7), entity_code: r.entity_code, net_total: 0, vat_amount: 0, grand_total: 0 };
        o.net_total = r2(o.net_total + Number(r.net_total));
        o.vat_amount = r2(o.vat_amount + Number(r.vat_amount));
        o.grand_total = r2(o.grand_total + Number(r.grand_total));
        by.set(k, o);
      }
      return [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
    },
  },
  'products-pricelist': {
    columns: [C('code', 'Code', 'الكود'), C('name', 'Product', 'المنتج', true),
      C('category', 'Category', 'الفئة', true), C('sub_category', 'Sub Category', 'الفئة الفرعية', true),
      C('unit', 'Unit', 'الوحدة'), C('standard_price', 'Price', 'السعر'),
      C('last_calculated_cost', 'Cost', 'التكلفة'), C('margin', 'Margin %', 'الهامش ٪')],
    run: async (sb) => {
      const { data } = await sb.from('qt_catalogue_products').select('*').is('deleted_at', null).neq('status', 'archived').order('category').limit(10000);
      return (data || []).map(p => ({
        ...p,
        margin: Number(p.standard_price) && Number(p.last_calculated_cost)
          ? r2((p.standard_price - p.last_calculated_cost) / p.standard_price * 100) : null,
      }));
    },
  },
  'material-price-moves': {
    columns: [C('name', 'Material', 'المادة', true), C('effective_date', 'Date', 'التاريخ'),
      C('previous_price', 'Old', 'السابق'), C('price', 'New', 'الجديد'),
      C('change_pct', 'Change %', 'التغير ٪'), C('source', 'Source', 'المصدر')],
    run: async (sb, url) => {
      const { from, to } = range(url);
      const { data } = await sb.from('qt_material_price_history')
        .select('price, previous_price, effective_date, source, material:qt_materials(name, name_en, name_ar)')
        .gte('effective_date', from).lte('effective_date', to)
        .not('previous_price', 'is', null)
        .order('effective_date', { ascending: false }).limit(5000);
      return (data || []).map(h => ({
        name: h.material ? h.material.name : '',
        name_en: h.material ? h.material.name_en : null,
        name_ar: h.material ? h.material.name_ar : null,
        effective_date: h.effective_date, previous_price: h.previous_price, price: h.price,
        change_pct: Number(h.previous_price) ? r2((h.price - h.previous_price) / h.previous_price * 100) : null,
        source: h.source,
      })).filter(h => h.change_pct !== 0);
    },
  },
  'top-materials': {
    columns: [C('name', 'Material', 'المادة', true), C('used_in_lines', 'Cost Lines', 'عدد البنود'),
      C('total_qty', 'Total Qty', 'إجمالي الكمية'), C('total_value', 'Total Value (SAR)', 'إجمالي القيمة (ر.س)')],
    run: async (sb) => {
      const { data } = await sb.from('qt_qp_cost_lines')
        .select('name, qty, line_total').in('section', ['material', 'hardware']).limit(20000);
      const by = new Map();
      for (const l of data || []) {
        const k = l.name || '—';
        const o = by.get(k) || { name: k, used_in_lines: 0, total_qty: 0, total_value: 0 };
        o.used_in_lines++; o.total_qty = r2(o.total_qty + Number(l.qty)); o.total_value = r2(o.total_value + Number(l.line_total));
        by.set(k, o);
      }
      return [...by.values()].sort((a, b) => b.total_value - a.total_value).slice(0, 200);
    },
  },
  'labour-rates': {
    columns: [C('name', 'Role', 'الوظيفة', true), C('hourly_rate', 'Hourly', 'بالساعة'),
      C('daily_rate', 'Daily', 'باليوم'), C('monthly_rate', 'Monthly', 'بالشهر')],
    run: async (sb) => (await sb.from('qt_labour_roles').select('*').is('deleted_at', null).order('name')).data || [],
  },
  'machines': {
    columns: [C('code', 'Code', 'الكود'), C('name', 'Machine', 'الماكينة', true),
      C('category', 'Category', 'الفئة', true), C('hourly_cost', 'Hourly Cost', 'تكلفة الساعة'),
      C('setup_cost', 'Setup Cost', 'تكلفة التجهيز')],
    run: async (sb) => (await sb.from('qt_machines').select('*').is('deleted_at', null).order('name')).data || [],
  },
  'expenses': {
    columns: [C('name', 'Expense', 'المصروف', true), C('category', 'Category', 'الفئة'),
      C('default_amount', 'Default', 'الافتراضي'), C('unit', 'Unit', 'الوحدة')],
    run: async (sb) => (await sb.from('qt_expense_templates').select('*').is('deleted_at', null).order('category')).data || [],
  },
  /* Materials Report — built entirely from the EXISTING qt_materials
     table (+ its category / supplier lookups). No new tables, no schema
     change. Category / Sub Category are derived from the material's
     category and its parent in qt_material_categories (parent = Category,
     leaf = Sub Category). Stock columns are intentionally omitted: this
     schema has no stock/min-stock fields, and inventing them would mean a
     schema change (out of scope) — Cost maps to the material's latest
     price. Textual columns carry *_en/*_ar so the shared localizer picks
     the right language just like every other report. */
  'materials-report': {
    columns: [C('code', 'Material Code', 'كود المادة'), C('name', 'Material Name', 'اسم المادة', true),
      C('category', 'Category', 'الفئة', true), C('sub_category', 'Sub Category', 'الفئة الفرعية', true),
      C('unit', 'Unit', 'الوحدة'), C('supplier', 'Supplier', 'المورد', true),
      C('latest_price', 'Cost', 'التكلفة'), C('status', 'Status', 'الحالة'),
      C('created_at', 'Created Date', 'تاريخ الإنشاء'), C('updated_at', 'Last Updated', 'آخر تحديث')],
    run: async (sb) => {
      const [matsRes, catsRes, supsRes] = await Promise.all([
        sb.from('qt_materials').select('*').is('deleted_at', null).order('code').limit(10000),
        sb.from('qt_material_categories').select('id, name_en, name_ar, parent_id'),
        sb.from('qt_suppliers').select('id, name_en, name_ar'),
      ]);
      const catMap = new Map((catsRes.data || []).map(c => [c.id, c]));
      const supMap = new Map((supsRes.data || []).map(s => [s.id, s]));
      return (matsRes.data || []).map(m => {
        const leaf = catMap.get(m.category_id) || null;
        const parent = leaf && leaf.parent_id ? (catMap.get(leaf.parent_id) || null) : null;
        const cat = parent || leaf;          // top category
        const sub = parent ? leaf : null;    // sub category only when a hierarchy exists
        const sup = supMap.get(m.default_supplier_id) || null;
        return {
          code: m.code || '',
          name: m.name_en || m.name_ar || '', name_en: m.name_en, name_ar: m.name_ar,
          category: cat ? (cat.name_en || cat.name_ar || '') : '', category_en: cat ? cat.name_en : null, category_ar: cat ? cat.name_ar : null,
          sub_category: sub ? (sub.name_en || sub.name_ar || '') : '', sub_category_en: sub ? sub.name_en : null, sub_category_ar: sub ? sub.name_ar : null,
          unit: m.unit || '',
          supplier: sup ? (sup.name_en || sup.name_ar || '') : '', supplier_en: sup ? sup.name_en : null, supplier_ar: sup ? sup.name_ar : null,
          latest_price: m.latest_price,
          status: m.status || '',
          created_at: m.created_at ? String(m.created_at).slice(0, 10) : '',
          updated_at: m.updated_at ? String(m.updated_at).slice(0, 10) : '',
        };
      });
    },
  },
};

export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const def = REPORTS[params.slug];
  if (!def) return json({ error: 'Unknown report.' }, 404);
  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const rows = await def.run(getDb(), url);

  /* Localize stored text values + headers to one language. Stored
     bilingual pairs (*_en/*_ar, v6 model) win; legacy rows without the
     pair fall back to runtime translation. */
  const textualKeys = def.columns.filter(c => c.textual).map(c => c.key);
  for (const r of rows) {
    for (const k of textualKeys) {
      const en = r[k + '_en'], ar = r[k + '_ar'];
      const stored = lang === 'ar' ? (ar || en) : (en || ar);
      if (stored) { r[k] = stored; continue; }
      const v = r[k];
      if (typeof v === 'string' && v && (lang === 'ar') !== hasArabic(v)) r[k] = translate(v, lang);
    }
  }
  const columns = def.columns.map(c => ({ key: c.key, header: lang === 'ar' ? c.ar : c.en }));

  const format = url.searchParams.get('format') || 'json';
  const filename = `${params.slug}-${new Date().toISOString().slice(0, 10)}-${lang}`;
  if (format === 'xlsx') return xlsxResponse(await buildXlsx({ sheetName: params.slug, columns, rows, rtl: lang === 'ar' }), filename + '.xlsx');
  if (format === 'csv') return csvResponse(columns, rows, filename + '.csv');
  return json({ columns, rows });
}
