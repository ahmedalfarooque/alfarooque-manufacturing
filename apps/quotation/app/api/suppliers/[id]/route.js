'use strict';

const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['name', 'name_en', 'name_ar', 'contact_person', 'phone', 'email', 'address', 'country', 'currency',
  'bank_name', 'iban', 'contacts', 'vat_number', 'cr_number', 'categories', 'payment_terms', 'rating', 'notes', 'status'];

const handlers = makeItemHandlers({ table: 'qt_suppliers', fields: FIELDS, bilingual: ['name'] });
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
