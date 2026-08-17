'use strict';

const { getDb } = require('@/lib/db');
const { json, requireSession , requireAction } = require('@/lib/http');
const { hasSmartErpEnvironment, SMARTLIFE_RESOURCES } = require('../../../../shared/integrationPlatform');

const SMARTLIFE_MODULE_LABELS = {
  products: 'Products', customers: 'Customers', suppliers: 'Suppliers',
  'sales-invoices': 'Sales', purchases: 'Purchases', categories: 'Categories',
  brands: 'Brands', units: 'Units', warehouses: 'Warehouses / Branches',
  tax: 'Tax', 'gift-cards': 'Gift Cards', coupons: 'Coupons',
  accounts: 'Accounting', 'cost-centers': 'Cost Centers', users: 'Users', cashiers: 'Cashiers',
};

export async function GET(req) {
  const { response } = await requireAction(req, 'view');
  if (response) return response;
  const sb = getDb();
  const [integrations, runs, conflicts, quotations, projects, inventory, cars, accounting, crm, smartlifeModules] = await Promise.all([
    sb.from('crm_integrations').select('id,integration_key,name,provider,integration_type,enabled,status,sync_direction,sync_frequency_minutes,last_sync_at,next_sync_at,last_error,config,updated_at').order('name'),
    sb.from('crm_sync_runs').select('id,integration_id,status,records_total,records_succeeded,records_failed,created_at,completed_at,error_summary').order('created_at', { ascending: false }).limit(30),
    sb.from('crm_sync_conflicts').select('id,integration_id,status', { count: 'exact' }).eq('status', 'open'),
    sb.from('qt_quotations').select('id', { count: 'exact', head: true }),
    sb.from('pm_projects').select('id', { count: 'exact', head: true }),
    sb.from('inv_products').select('id', { count: 'exact', head: true }),
    sb.from('cars').select('id', { count: 'exact', head: true }),
    sb.from('acc_chart_of_accounts').select('id', { count: 'exact', head: true }),
    sb.from('crm_contacts').select('id', { count: 'exact', head: true }),
    sb.from('crm_integration_module_status').select('integration_id,module_key,status,records_read,last_synced_at,last_error'),
  ]);
  if (integrations.error) return json({ error: 'Integration platform migration is not applied.', detail: integrations.error.message }, 503);
  const moduleResults = [
    ['quotation','QuotePro / Quotations',quotations],
    ['projects','Projects',projects],
    ['inventory','Inventory',inventory],
    ['cars','Cars',cars],
    ['accounting','Accounting',accounting],
    ['crm','CRM',crm],
  ];
  const rows = (integrations.data || []).map(item => {
    const latest = (runs.data || []).find(run => run.integration_id === item.id);
    let modules;
    if (item.integration_key === 'alfarooque_erp') {
      modules = moduleResults.map(([key,name,result]) => ({ key, name, status: result.error ? 'error' : 'connected', health: result.error ? 'Error' : 'Healthy', records: result.error ? null : (result.count || 0), lastSync: item.last_sync_at, error: result.error?.message || null }));
    } else if (item.integration_key === 'smartlife') {
      const statusByKey = new Map((smartlifeModules.data || []).filter(m => m.integration_id === item.id).map(m => [m.module_key, m]));
      modules = Object.keys(SMARTLIFE_RESOURCES).map(key => {
        const found = statusByKey.get(key);
        return {
          key, name: SMARTLIFE_MODULE_LABELS[key] || key,
          status: found?.status || 'pending',
          health: found?.status === 'connected' ? 'Healthy' : found?.status === 'permission_required' ? 'Permission required' : found?.status === 'error' ? 'Error' : 'Not yet synchronized',
          records: found?.records_read ?? null, lastSync: found?.last_synced_at || null, error: found?.last_error || null,
        };
      });
    }
    const erpError = item.integration_key === 'alfarooque_erp' ? modules?.find(module => module.status === 'error') : null;
    return { ...item, status: erpError ? 'error' : item.status, modules, config: item.integration_key === 'smartlife' ? { serverConfigured: hasSmartErpEnvironment() } : (item.config || {}), latestRun: latest || null, openConflicts: (conflicts.data || []).filter(c => c.integration_id === item.id).length };
  });
  return json({ integrations: rows, pending: (runs.data || []).filter(r => ['pending','running'].includes(r.status)).length, failed: (runs.data || []).filter(r => r.status === 'failed').length, conflicts: conflicts.count || 0 });
}
