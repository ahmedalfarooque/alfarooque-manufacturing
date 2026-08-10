-- Atomic Quotation -> Quotation Approval workflow.
-- The API authenticates/authorizes callers; these SECURITY INVOKER functions
-- make each cross-table state transition one PostgreSQL transaction.

alter table public.qt_quotations drop constraint if exists qt_quotations_status_check;

update public.qt_quotations set status = 'waiting_quotation_approval' where status = 'waiting_production_approval';
update public.qt_quotations set status = 'quotation_approved' where status = 'production_approved';
update public.qt_quotations set status = 'quotation_rejected' where status = 'production_rejected';

alter table public.qt_quotations add constraint qt_quotations_status_check check (status in (
  'draft', 'submitted', 'waiting_quotation_approval',
  'quotation_approved', 'quotation_rejected',
  'customer_approved', 'customer_rejected', 'project_created',
  -- Historical values remain readable during the legacy-data transition.
  'pending_approval', 'approved', 'sent', 'accepted', 'rejected',
  'expired', 'superseded', 'cancelled', 'contracted', 'started',
  'customer_accepted', 'contract_submitted', 'contract_accepted',
  'project_sent', 'project_rejected'
));

alter table public.project_requests drop constraint if exists project_requests_status_check;
update public.project_requests set status = 'approved' where status = 'accepted';
update public.project_requests set status = 'pending' where status = 'on_hold';
alter table public.project_requests add constraint project_requests_status_check
  check (status in ('pending', 'approved', 'rejected'));

drop index if exists public.project_requests_active_uidx;
create unique index project_requests_active_uidx
  on public.project_requests (quotation_id) where status <> 'rejected';

create or replace function public.qt_submit_for_quotation_approval(
  p_quotation_id uuid,
  p_requested_by uuid
) returns public.project_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quotation public.qt_quotations;
  v_request public.project_requests;
begin
  select * into v_quotation
  from public.qt_quotations
  where id = p_quotation_id and deleted_at is null
  for update;

  if not found then raise exception 'Quotation not found.' using errcode = 'P0002'; end if;

  select * into v_request
  from public.project_requests
  where quotation_id = p_quotation_id and status <> 'rejected'
  order by created_at desc limit 1;

  if v_quotation.status = 'waiting_quotation_approval' and v_request.id is not null then
    return v_request;
  end if;
  if v_quotation.status <> 'draft' then
    raise exception 'Only drafts can be submitted.' using errcode = 'P0001';
  end if;

  if v_request.id is null then
    insert into public.project_requests (
      quotation_id, quote_number, customer_id, amount, status, requested_by
    ) values (
      v_quotation.id, v_quotation.quote_number, v_quotation.customer_id,
      coalesce(v_quotation.grand_total, 0), 'pending', p_requested_by
    ) returning * into v_request;
  end if;

  update public.qt_quotations set
    status = 'waiting_quotation_approval',
    project_status = 'pending',
    project_request_id = v_request.id,
    updated_by = p_requested_by,
    updated_at = now()
  where id = p_quotation_id;

  return v_request;
end;
$$;

create or replace function public.qt_decide_quotation_approval(
  p_request_id uuid,
  p_decision text,
  p_note text,
  p_actor_id uuid
) returns public.project_requests
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_request public.project_requests;
  v_next_status text;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid quotation approval decision.' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(btrim(p_note), '') is null then
    raise exception 'A rejection reason is required.' using errcode = '22023';
  end if;

  select * into v_request from public.project_requests where id = p_request_id for update;
  if not found then raise exception 'Quotation approval request not found.' using errcode = 'P0002'; end if;
  if v_request.project_id is not null then
    raise exception 'A project has already been created from this request.' using errcode = 'P0001';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been decided.' using errcode = 'P0001';
  end if;

  perform 1 from public.qt_quotations
  where id = v_request.quotation_id and status = 'waiting_quotation_approval'
  for update;
  if not found then
    raise exception 'The linked quotation is not waiting for quotation approval.' using errcode = 'P0001';
  end if;

  v_next_status := case when p_decision = 'approved' then 'quotation_approved' else 'quotation_rejected' end;

  update public.project_requests set
    status = p_decision,
    note = nullif(btrim(p_note), ''),
    updated_at = now()
  where id = p_request_id returning * into v_request;

  update public.qt_quotations set
    status = v_next_status,
    project_status = p_decision,
    project_request_id = p_request_id,
    rejection_reason = case when p_decision = 'rejected' then nullif(btrim(p_note), '') else null end,
    rejected_by = case when p_decision = 'rejected' then p_actor_id else null end,
    rejected_at = case when p_decision = 'rejected' then now() else null end,
    updated_at = now()
  where id = v_request.quotation_id;

  insert into public.qt_quotation_events (quotation_id, event, detail, actor_id)
  values (
    v_request.quotation_id,
    v_next_status,
    jsonb_build_object(
      'previous_status', 'waiting_quotation_approval', 'new_status', v_next_status,
      'department', 'Quotation', 'reason', nullif(btrim(p_note), ''), 'request_id', p_request_id
    ),
    p_actor_id
  );

  return v_request;
end;
$$;

revoke execute on function public.qt_submit_for_quotation_approval(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.qt_decide_quotation_approval(uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.qt_submit_for_quotation_approval(uuid, uuid) to service_role;
grant execute on function public.qt_decide_quotation_approval(uuid, text, text, uuid) to service_role;

notify pgrst, 'reload schema';
