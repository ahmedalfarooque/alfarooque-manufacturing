-- Consolidate internal ERP modules into one CRM integration identity.
begin;

insert into public.crm_integrations (
  tenant_id, integration_key, name, provider, integration_type, enabled,
  status, sync_direction, config
)
values (
  'alfarooque', 'alfarooque_erp', 'AL FAROOQUE ERP', 'AL FAROOQUE ERP',
  'internal_erp', true, 'connected', 'none',
  '{"authentication":"Central ERP authentication","connection":"Central ERP integration layer","modules":["quotation","projects","inventory","cars"]}'::jsonb
)
on conflict (tenant_id, integration_key) do update set
  name = excluded.name,
  provider = excluded.provider,
  integration_type = excluded.integration_type,
  enabled = true,
  config = excluded.config,
  updated_at = now();

do $$
declare
  target_id uuid;
  old_ids uuid[];
begin
  select id into target_id from public.crm_integrations
    where tenant_id = 'alfarooque' and integration_key = 'alfarooque_erp';
  select coalesce(array_agg(id), '{}'::uuid[]) into old_ids
    from public.crm_integrations
    where tenant_id = 'alfarooque'
      and integration_key in ('quotation','projects','inventory','cars');

  update public.crm_sync_runs set integration_id = target_id where integration_id = any(old_ids);
  update public.crm_sync_conflicts set integration_id = target_id where integration_id = any(old_ids);
  update public.crm_webhook_endpoints set integration_id = target_id where integration_id = any(old_ids);
  update public.crm_webhook_events set integration_id = target_id where integration_id = any(old_ids);
  update public.crm_integration_audit_logs set integration_id = target_id where integration_id = any(old_ids);

  delete from public.crm_integrations where id = any(old_ids);
end $$;

update public.crm_integrations
set name = 'AL FAROOQUE WEBSITE', provider = 'AL FAROOQUE WEBSITE', updated_at = now()
where tenant_id = 'alfarooque' and integration_key = 'website';

commit;
