'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { APPS, ROLES, modulesFor, levelToActions, defaultPermission, moduleFromPath } = require('./permissionRegistry');

test('uses QuotePro current role list in every application', () => {
  assert.deepEqual(ROLES, ['admin', 'manager', 'sales', 'estimator', 'accountant', 'production', 'readonly']);
  assert.equal(APPS.length, 6);
  for (const app of APPS) assert.ok(modulesFor(app).some(module => module.id === 'users'));
});

test('maps simplified levels to exact View/Add/Edit/Delete semantics', () => {
  assert.deepEqual(levelToActions('view_only'), { view: true, add: false, edit: false, delete: false });
  assert.deepEqual(levelToActions('view_edit'), { view: true, add: false, edit: true, delete: false });
  assert.deepEqual(levelToActions('full_access'), { view: true, add: true, edit: true, delete: true });
});

test('keeps Users administration denied to non-admin roles', () => {
  for (const role of ROLES.filter(role => role !== 'admin')) {
    assert.deepEqual(defaultPermission(role, 'accounting', 'users'), { view: false, add: false, edit: false, delete: false, miscellaneous: {} });
  }
  assert.equal(defaultPermission('admin', 'accounting', 'users').delete, true);
});

test('module registry follows active application paths and aliases', () => {
  assert.equal(moduleFromPath('inventory', '/api/products/123'), 'products');
  assert.equal(moduleFromPath('cars', '/api/cars/123'), 'vehicles');
  assert.equal(moduleFromPath('cars', '/api/insurance'), 'insurance');
  assert.equal(moduleFromPath('cars', '/api/inspection'), 'inspection');
  assert.equal(moduleFromPath('cars', '/api/expiry-alerts'), 'alerts');
  assert.equal(moduleFromPath('cars', '/api/alert-settings/recipients'), 'alerts');
  assert.equal(moduleFromPath('quotation', '/api/material-categories'), 'materials');
  assert.equal(moduleFromPath('accounting', '/api/invoices/123'), 'sales-invoices');
  assert.equal(modulesFor('crm').some(module => module.id === 'restaurants'), false);
});
