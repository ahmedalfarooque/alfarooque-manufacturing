-- Keep the single AL FAROOQUE ERP integration identity aligned with all internal applications.
begin;

update public.crm_integrations
set config = jsonb_set(
      coalesce(config, '{}'::jsonb),
      '{modules}',
      '["quotation","projects","inventory","cars","accounting","crm"]'::jsonb,
      true
    ),
    updated_at = now()
where tenant_id = 'alfarooque'
  and integration_key = 'alfarooque_erp';

commit;
