'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['name', 'name_en', 'name_ar', 'category', 'default_amount', 'unit', 'notes', 'status'];

export const GET = makeListHandler({
  table: 'qt_expense_templates',
  searchCols: ['name', 'name_en', 'name_ar', 'category'],
  fields: FIELDS,
  defaultOrder: 'name',
});

export const POST = makeCreateHandler({ table: 'qt_expense_templates', fields: FIELDS, required: ['name'], bilingual: ['name'] });
