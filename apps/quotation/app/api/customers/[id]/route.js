'use strict';

const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['code', 'company_name', 'company_name_en', 'company_name_ar',
  'contact_person', 'contact_person_en', 'contact_person_ar', 'phone', 'phone2',
  'email', 'address', 'city', 'customer_type', 'vat_number', 'cr_number', 'tags', 'notes', 'status'];

const handlers = makeItemHandlers({ table: 'qt_customers', fields: FIELDS, bilingual: ['company_name', 'contact_person'] });
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
