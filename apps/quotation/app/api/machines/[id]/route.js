'use strict';

const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['code', 'name', 'name_en', 'name_ar', 'category', 'hourly_cost', 'setup_cost', 'notes', 'status'];

const handlers = makeItemHandlers({ table: 'qt_machines', fields: FIELDS, bilingual: ['name'] });
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
