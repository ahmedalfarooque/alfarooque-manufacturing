-- Legacy revisions may share one project_request_id. Unlink every referencing
-- revision before deletion, but preserve terminal historical statuses.
create or replace function public.qt_delete_quotation_approval_request(
  p_request_id uuid,
  p_actor_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_request public.project_requests;
begin
  select * into v_request
  from public.project_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Quotation Approval request not found.' using errcode = 'P0002';
  end if;
  if v_request.project_id is not null then
    raise exception 'This approval already has a linked project and cannot be deleted.' using errcode = 'P0001';
  end if;

  perform 1 from public.qt_quotations
  where project_request_id = p_request_id
  for update;

  update public.qt_quotations set
    status = case
      when id = v_request.quotation_id and status in (
        'waiting_quotation_approval', 'quotation_approved', 'quotation_rejected'
      ) then 'draft'
      else status
    end,
    project_status = null,
    project_request_id = null,
    rejection_reason = case when id = v_request.quotation_id then null else rejection_reason end,
    rejected_by = case when id = v_request.quotation_id then null else rejected_by end,
    rejected_at = case when id = v_request.quotation_id then null else rejected_at end,
    updated_at = now()
  where project_request_id = p_request_id;

  insert into public.qt_quotation_events (quotation_id, event, detail, actor_id)
  values (
    v_request.quotation_id,
    'quotation_approval_deleted',
    jsonb_build_object(
      'previous_status', v_request.status,
      'request_id', p_request_id,
      'department', 'Quotation'
    ),
    p_actor_id
  );

  delete from public.project_requests where id = p_request_id;
  return jsonb_build_object('ok', true, 'quotation_id', v_request.quotation_id);
end;
$$;

revoke execute on function public.qt_delete_quotation_approval_request(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.qt_delete_quotation_approval_request(uuid, uuid)
  to service_role;

notify pgrst, 'reload schema';
