'use strict';

/* Export / template downloads, localized to the requested language.
   GET /api/export/{table}?format=xlsx|csv&template=1&lang=en|ar
   Tables: products, suppliers, materials, customers, quotations.
   Single-language data model: one Name/Description column; headers and
   filenames follow ?lang=; Arabic exports translate stored values via
   the dictionary engine so the whole sheet reads in one language.     */

const { getDb } = require('@/lib/db');
const { json, requireSession } = require('@/lib/http');
const { buildXlsx, xlsxResponse, csvResponse } = require('@/lib/sheets');
const { translate, hasArabic } = require('@/lib/translate');

export const runtime = 'nodejs';

const C = (key, en, ar, textual) => ({ key, en, ar, textual: !!textual });

const DEFS = {
  products: {
    table: 'qt_catalogue_products', sheet: 'Products', order: 'code',
    columns: [
      C('code', 'Product ID', 'رقم المنتج'), C('sku', 'SKU', 'SKU'), C('barcode', 'Barcode', 'الباركود'),
      C('name', 'Product Name', 'اسم المنتج', true),
      C('category', 'Category', 'الفئة', true), C('sub_category', 'Sub Category', 'الفئة الفرعية', true),
      C('description', 'Description', 'الوصف', true),
      C('unit', 'Unit', 'الوحدة'),
      C('length', 'Length (mm)', 'الطول (مم)'), C('width', 'Width (mm)', 'العرض (مم)'),
      C('height', 'Height (mm)', 'الارتفاع (مم)'), C('thickness', 'Thickness (mm)', 'السماكة (مم)'),
      C('depth', 'Depth (mm)', 'العمق (مم)'), C('diameter', 'Diameter (mm)', 'القطر (مم)'),
      C('weight', 'Weight (kg)', 'الوزن (كجم)'), C('area', 'Area (m2)', 'المساحة (م٢)'),
      C('volume', 'Volume (m3)', 'الحجم (م٣)'),
      C('standard_price', 'Price (SAR)', 'السعر (ر.س)'), C('last_calculated_cost', 'Last Cost (SAR)', 'آخر تكلفة (ر.س)'),
      C('image_path', 'Image URL', 'رابط الصورة'), C('status', 'Status', 'الحالة'), C('notes', 'Notes', 'ملاحظات', true),
    ],
    map: (r) => ({ ...r, ...(r.dimensions || {}) }),
    example: { code: '', sku: 'DR-INT-001', barcode: '628…', name: 'Premium MDF Door', category: 'DOORS', sub_category: 'Interior', unit: 'nos', length: 900, width: 2100, thickness: 45, standard_price: 1500, status: 'active' },
  },
  suppliers: {
    table: 'qt_suppliers', sheet: 'Suppliers', order: 'name',
    columns: [
      C('name', 'Supplier Name', 'اسم المورد', true), C('contact_person', 'Contact Person', 'المسؤول', true),
      C('phone', 'Phone', 'الجوال'), C('email', 'Email', 'البريد'), C('address', 'Address', 'العنوان', true),
      C('country', 'Country', 'الدولة', true), C('currency', 'Currency', 'العملة'),
      C('vat_number', 'VAT No', 'الرقم الضريبي'), C('cr_number', 'CR No', 'السجل التجاري'),
      C('payment_terms', 'Payment Terms', 'شروط الدفع', true), C('bank_name', 'Bank Name', 'البنك', true),
      C('iban', 'IBAN', 'الآيبان'), C('rating', 'Rating (1-5)', 'التقييم'), C('status', 'Status', 'الحالة'),
      C('notes', 'Notes', 'ملاحظات', true),
    ],
    example: { name: 'مؤسسة الأخشاب', phone: '05xxxxxxxx', country: 'Saudi Arabia', currency: 'SAR', payment_terms: '30 days', rating: 4, status: 'active' },
  },
  materials: {
    table: 'qt_materials', sheet: 'Materials', order: 'code',
    columns: [
      C('code', 'Code', 'الكود'), C('barcode', 'Barcode', 'الباركود'),
      C('name', 'Material Name', 'اسم المادة', true),
      C('kind', 'Kind (material/hardware)', 'النوع (مواد/إكسسوارات)'),
      C('material_type', 'Type', 'الصنف', true),
      C('height_value', 'Height', 'الارتفاع'), C('height_unit', 'Height Unit', 'وحدة الارتفاع'),
      C('width_value', 'Width', 'العرض'), C('width_unit', 'Width Unit', 'وحدة العرض'),
      C('length_value', 'Length', 'الطول'), C('length_unit', 'Length Unit', 'وحدة الطول'),
      C('thickness_value', 'Thickness', 'السماكة'), C('thickness_unit', 'Thickness Unit', 'وحدة السماكة'),
      C('unit', 'Unit', 'الوحدة'), C('brand', 'Brand', 'الماركة'),
      C('latest_price', 'Price (SAR)', 'السعر (ر.س)'), C('default_waste_pct', 'Waste %', 'الهدر ٪'),
      C('status', 'Status', 'الحالة'), C('notes', 'Notes', 'ملاحظات', true),
    ],
    example: { code: 'M-00001', name: 'ام دي اف 18مم', kind: 'material', thickness_value: 18, thickness_unit: 'mm', unit: 'sheet', latest_price: 185, default_waste_pct: 10, status: 'active' },
  },
  customers: {
    table: 'qt_customers', sheet: 'Customers', order: 'company_name',
    columns: [
      C('company_name', 'Company Name', 'اسم الشركة', true),
      C('contact_person', 'Contact Person', 'المسؤول', true),
      C('phone', 'Phone', 'الجوال'), C('phone2', 'Phone 2', 'جوال ٢'),
      C('email', 'Email', 'البريد'), C('city', 'City', 'المدينة', true), C('customer_type', 'Type', 'النوع'),
      C('vat_number', 'VAT No', 'الرقم الضريبي'), C('cr_number', 'CR No', 'السجل التجاري'),
      C('address', 'Address', 'العنوان', true), C('status', 'Status', 'الحالة'), C('notes', 'Notes', 'ملاحظات', true),
    ],
    example: { company_name: 'فندق المثال', customer_type: 'hotel', phone: '05xxxxxxxx', city: 'Jeddah', status: 'active' },
  },
  quotations: {
    table: 'qt_quotations', sheet: 'Quotations', order: 'created_at',
    columns: [
      C('quote_number', 'Number', 'الرقم'), C('status', 'Status', 'الحالة'), C('quote_date', 'Date', 'التاريخ'),
      C('valid_until', 'Valid Until', 'صالح حتى'), C('subtotal', 'Subtotal', 'المجموع'),
      C('discount_amount', 'Discount', 'الخصم'), C('net_total', 'Net', 'الصافي'),
      C('vat_amount', 'VAT', 'الضريبة'), C('grand_total', 'Grand Total', 'الإجمالي'),
      C('total_cost', 'Internal Cost', 'التكلفة الداخلية'), C('blended_margin_pct', 'Margin %', 'الهامش ٪'),
    ],
    exportOnly: true,
  },
};

export async function GET(req, { params }) {
  const { session, response } = requireSession(req);
  if (!session) return response;
  const def = DEFS[params.table];
  if (!def) return json({ error: 'Unknown export.' }, 404);

  const url = new URL(req.url);
  const lang = url.searchParams.get('lang') === 'ar' ? 'ar' : 'en';
  const format = url.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
  const isTemplate = url.searchParams.get('template') === '1' && !def.exportOnly;
  const columns = def.columns.map(c => ({ key: c.key, header: lang === 'ar' ? c.ar : c.en }));
  const textualKeys = def.columns.filter(c => c.textual).map(c => c.key);
  const stamp = new Date().toISOString().slice(0, 10);

  let rows = [];
  if (isTemplate) {
    rows = def.example ? [def.example] : [];
  } else {
    const sb = getDb();
    const { data, error } = await sb.from(def.table).select('*').is('deleted_at', null)
      .order(def.order, { ascending: def.order !== 'created_at' }).limit(20000);
    if (error) return json({ error: error.message }, 500);
    rows = (data || []).map(r => def.map ? def.map(r) : { ...r });
    /* Localize stored text values so the export reads in one language. */
    for (const r of rows) {
      for (const k of textualKeys) {
        const v = r[k];
        if (typeof v === 'string' && v && (lang === 'ar') !== hasArabic(v)) r[k] = translate(v, lang);
      }
    }
  }

  const filename = `${params.table}${isTemplate ? '-template' : '-' + stamp}-${lang}.${format}`;
  if (format === 'csv') return csvResponse(columns, rows, filename);
  const buf = await buildXlsx({ sheetName: def.sheet, columns, rows });
  return xlsxResponse(buf, filename);
}
