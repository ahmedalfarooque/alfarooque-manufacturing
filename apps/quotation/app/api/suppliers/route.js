'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['name', 'name_en', 'name_ar', 'contact_person', 'phone', 'email', 'address', 'country', 'currency',
  'bank_name', 'iban', 'contacts', 'vat_number', 'cr_number', 'categories', 'payment_terms', 'rating', 'notes', 'status'];

export const GET = makeListHandler({
  table: 'qt_suppliers',
  searchCols: ['name', 'name_en', 'name_ar', 'contact_person', 'phone'],
  fields: FIELDS,
});

export const POST = makeCreateHandler({ table: 'qt_suppliers', fields: FIELDS, required: ['name'], bilingual: ['name'] });
