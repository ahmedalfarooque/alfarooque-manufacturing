'use strict';

const { makeItemHandlers } = require('@/lib/crud');

const FIELDS = ['name', 'name_en', 'name_ar', 'hourly_rate', 'daily_rate', 'monthly_rate',
  'overtime_multiplier', 'default_unit', 'notes', 'status'];

const RATE_FIELDS = ['hourly_rate', 'daily_rate', 'monthly_rate'];

const handlers = makeItemHandlers({
  table: 'qt_labour_roles',
  fields: FIELDS,
  bilingual: ['name'],
  /* Rate changes append qt_labour_rate_history rows (FR-LAB-3). */
  afterUpdate: async ({ sb, session, before, after }) => {
    const rows = RATE_FIELDS
      .filter(f => Number(before[f]) !== Number(after[f]))
      .map(f => ({
        labour_role_id: after.id, field: f,
        old_value: before[f], new_value: after[f], created_by: session.sub,
      }));
    if (rows.length) await sb.from('qt_labour_rate_history').insert(rows);
  },
});
export const GET = handlers.GET;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
