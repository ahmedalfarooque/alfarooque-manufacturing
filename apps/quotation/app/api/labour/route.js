'use strict';

const { makeListHandler, makeCreateHandler } = require('@/lib/crud');

const FIELDS = ['name', 'name_en', 'name_ar', 'hourly_rate', 'daily_rate', 'monthly_rate',
  'overtime_multiplier', 'default_unit', 'notes', 'status'];

export const GET = makeListHandler({
  table: 'qt_labour_roles',
  searchCols: ['name', 'name_en', 'name_ar'],
  fields: FIELDS,
  defaultOrder: 'name',
});

export const POST = makeCreateHandler({ table: 'qt_labour_roles', fields: FIELDS, required: ['name'], bilingual: ['name'] });
