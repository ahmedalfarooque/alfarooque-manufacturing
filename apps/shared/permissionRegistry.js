'use strict';

const APPS = ['quotation', 'projects', 'cars', 'inventory', 'accounting', 'crm'];
const ROLES = ['admin', 'manager', 'sales', 'estimator', 'accountant', 'production', 'readonly'];
const ACTIONS = ['view', 'add', 'edit', 'delete'];
const ACCESS_LEVELS = ['view_only', 'view_edit', 'full_access'];

const MODULES = {
  quotation: [
    ['general', 'dashboard', 'Dashboard'], ['sales', 'quotations', 'Quotations'],
    ['customers', 'customers', 'Customers'], ['sales', 'catalogue', 'Catalogue'],
    ['production', 'materials', 'Materials'], ['customers', 'suppliers', 'Suppliers'],
    ['production', 'labour', 'Labour'], ['production', 'machines', 'Machines'],
    ['accounting', 'expenses', 'Expenses'], ['reports', 'reports', 'Reports'],
    ['administration', 'users', 'Users & Roles'], ['administration', 'settings', 'Settings'],
    ['administration', 'audit', 'Audit Log'],
  ],
  projects: [
    ['general', 'dashboard', 'Dashboard'], ['projects', 'projects', 'Projects'],
    ['sales', 'sales-orders', 'Sales Orders'], ['sales', 'orders', 'Orders'],
    ['sales', 'quotes', 'Quotes'], ['purchasing', 'purchase-requests', 'Purchase Requests'],
    ['projects', 'quotation-requests', 'Quotation Approvals'], ['customers', 'customers', 'Customers'],
    ['administration', 'users', 'Users & Roles'],
  ],
  cars: [
    ['general', 'dashboard', 'Dashboard'], ['fleet', 'vehicles', 'Vehicles'],
    ['fleet', 'drivers', 'Drivers'], ['maintenance', 'maintenance-schedule', 'Maintenance Schedule'],
    ['maintenance', 'maintenance', 'Maintenance'], ['maintenance', 'maintenance-shops', 'Maintenance Shops'],
    ['general', 'alerts', 'Alerts'], ['administration', 'users', 'Users & Roles'],
  ],
  inventory: [
    ['general', 'dashboard', 'Dashboard'], ['catalogue', 'products', 'Products'],
    ['catalogue', 'materials', 'Materials'], ['catalogue', 'categories', 'Categories'],
    ['purchasing', 'suppliers', 'Suppliers'], ['stock', 'warehouses', 'Warehouses'],
    ['stock', 'locations', 'Locations'], ['stock', 'stock', 'Stock'],
    ['stock', 'stock-movements', 'Stock Movements'], ['stock', 'reservations', 'Reservations'],
    ['stock', 'transfers', 'Transfers'], ['purchasing', 'purchase-requests', 'Purchase Requests'],
    ['purchasing', 'purchase-orders', 'Purchase Orders'], ['stock', 'goods-receipts', 'Goods Receipts'],
    ['stock', 'goods-issues', 'Goods Issues'], ['reports', 'reports', 'Reports'],
    ['administration', 'settings', 'Settings'], ['administration', 'users', 'Users & Roles'],
  ],
  accounting: [
    ['general', 'dashboard', 'Dashboard'], ['accounting', 'financial-reports', 'Financial Reports'],
    ['accounting', 'accounts', 'Chart of Accounts'], ['accounting', 'account-balances', 'Account Balances'],
    ['accounting', 'cost-centers', 'Cost Centers'], ['accounting', 'expenses', 'Expenses'],
    ['accounting', 'vat', 'VAT Report'], ['sales', 'sales-invoices', 'Sales Invoices'],
    ['customers', 'customers', 'Customers'], ['sales', 'payments', 'Payments'],
    ['purchasing', 'purchases', 'Purchase Invoices'], ['purchasing', 'purchase-requests', 'Purchase Requests'],
    ['customers', 'suppliers', 'Suppliers'], ['inventory', 'inventory', 'Inventory'],
    ['inventory', 'products', 'Products'], ['inventory', 'categories', 'Categories'],
    ['inventory', 'warehouses', 'Warehouses'], ['administration', 'settings', 'Settings'],
    ['administration', 'users', 'Users & Roles'],
  ],
  crm: [
    ['general', 'dashboard', 'Dashboard'], ['crm', 'contacts', 'Contacts'],
    ['crm', 'deals', 'Deals'], ['crm', 'activities', 'Activities'],
    ['crm', 'pipeline', 'Pipeline'], ['integrations', 'integrations', 'Integrations'],
    ['reports', 'reports', 'Reports'], ['administration', 'settings', 'Settings'],
    ['administration', 'users', 'Users & Roles'],
  ],
};

function modulesFor(appId) {
  return (MODULES[appId] || []).map(([category, id, label]) => ({ category, id, label }));
}

function levelToActions(level) {
  if (level === 'full_access') return { view: true, add: true, edit: true, delete: true };
  if (level === 'view_edit') return { view: true, add: false, edit: true, delete: false };
  return { view: true, add: false, edit: false, delete: false };
}

function defaultPermission(role, appId, moduleId) {
  if (role === 'admin') return { ...levelToActions('full_access'), miscellaneous: {} };
  if (moduleId === 'users') return { view: false, add: false, edit: false, delete: false, miscellaneous: {} };
  if (role === 'readonly' || role === 'production') return { ...levelToActions('view_only'), miscellaneous: {} };
  if (role === 'accountant') {
    const financial = ['accounting', 'expenses', 'vat', 'financial-reports', 'accounts', 'account-balances', 'cost-centers', 'reports', 'sales-invoices', 'purchases', 'payments'].includes(moduleId);
    return { ...levelToActions(financial ? 'view_edit' : 'view_only'), miscellaneous: {} };
  }
  if (role === 'sales') {
    const sales = ['quotations', 'customers', 'catalogue', 'sales-orders', 'quotes', 'contacts', 'deals', 'activities', 'pipeline', 'sales-invoices'].includes(moduleId);
    return { ...levelToActions(sales ? 'full_access' : 'view_only'), miscellaneous: {} };
  }
  if (role === 'estimator') {
    const costing = ['quotations', 'catalogue', 'materials', 'labour', 'machines', 'products'].includes(moduleId);
    return { ...levelToActions(costing ? 'view_edit' : 'view_only'), miscellaneous: {} };
  }
  // QuotePro's existing manager role can write/approve/report. Preserve that
  // broad operational access while keeping Users administration separate.
  return { ...levelToActions('full_access'), miscellaneous: {} };
}

function moduleFromPath(appId, pathname) {
  const clean = String(pathname || '').replace(/^\/api\//, '/').split('?')[0];
  const aliases = {
    cars: { cars: 'vehicles', shops: 'maintenance-shops', categories: 'vehicles', import: 'vehicles', 'maintenance-records': 'maintenance', stats: 'dashboard', search: 'dashboard', 'inventory-search': 'maintenance' },
    quotation: { 'material-categories': 'materials', 'bank-accounts': 'settings', contracts: 'quotations', translate: 'quotations' },
    projects: { 'daily-updates': 'projects', stats: 'dashboard', 'my-stats': 'dashboard', 'inventory-search': 'projects', warehouses: 'projects' },
    inventory: { brands: 'categories', subcategories: 'categories', units: 'categories', roles: 'users' },
    accounting: { invoices: 'sales-invoices', bills: 'purchases', 'chart-of-accounts': 'accounts', 'journal-entries': 'accounts', assets: 'accounts', banking: 'account-balances', reports: 'financial-reports', 'inventory-search': 'inventory' },
  };
  const first = clean.split('/').filter(Boolean)[0];
  if (first === 'smartlife') {
    const resource = clean.split('/').filter(Boolean)[1];
    const smartlifeAliases = { 'purchase-invoices': 'purchases', reports: 'financial-reports', relationships: 'financial-reports', sync: 'settings' };
    if (smartlifeAliases[resource]) return smartlifeAliases[resource];
    if (modulesFor(appId).some(module => module.id === resource)) return resource;
  }
  if (appId === 'accounting' && clean.startsWith('/smartlife/relationships')) return 'financial-reports';
  if (appId === 'accounting' && clean.startsWith('/smartlife/sync')) return 'settings';
  const aliased = aliases[appId]?.[first];
  if (aliased) return aliased;
  const candidates = modulesFor(appId).sort((a, b) => b.id.length - a.id.length);
  return candidates.find(m => clean === `/${m.id}` || clean.startsWith(`/${m.id}/`) || clean.includes(`/${m.id}/`))?.id || null;
}

module.exports = { APPS, ROLES, ACTIONS, ACCESS_LEVELS, MODULES, modulesFor, levelToActions, defaultPermission, moduleFromPath };
