'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'company_name', 'company_name_en', 'company_name_ar',
  'contact_person', 'contact_person_en', 'contact_person_ar', 'phone', 'phone2',
  'email', 'address', 'city', 'customer_type', 'vat_number', 'cr_number', 'tags', 'notes', 'status'];

export const GET = makeListHandler({
  table: 'qt_customers',
  searchCols: ['company_name', 'company_name_en', 'company_name_ar', 'contact_person', 'phone'],
  fields: FIELDS,
  filters: (q, params) => {
    const type = params.get('type');
    return type ? q.eq('customer_type', type) : q;
  },
});

export const POST = makeCreateHandler({ table: 'qt_customers', fields: FIELDS, required: ['company_name'], bilingual: ['company_name', 'contact_person'] });
