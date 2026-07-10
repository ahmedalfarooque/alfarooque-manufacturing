'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['code', 'name', 'name_en', 'name_ar', 'category', 'hourly_cost', 'setup_cost', 'notes', 'status'];

export const GET = makeListHandler({
  table: 'qt_machines',
  searchCols: ['name', 'name_en', 'name_ar', 'code', 'category'],
  fields: FIELDS,
  defaultOrder: 'name',
});

export const POST = makeCreateHandler({ table: 'qt_machines', fields: FIELDS, required: ['name'], bilingual: ['name'] });
