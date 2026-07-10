'use strict';

const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['name', 'name_en', 'name_ar', 'category', 'default_amount', 'unit', 'notes', 'status'];

const handlers = makeItemHandlers({ table: 'qt_expense_templates', fields: FIELDS, bilingual: ['name'] });
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
